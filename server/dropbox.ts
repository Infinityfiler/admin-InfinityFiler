import { supabase } from "./supabase";

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY || "";
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET || "";

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let cachedToken: TokenData | null = null;

export function getDropboxAuthUrl(redirectUri: string, state?: string): string {
  const params: Record<string, string> = {
    client_id: DROPBOX_APP_KEY,
    redirect_uri: redirectUri,
    response_type: "code",
    token_access_type: "offline",
  };
  if (state) params.state = state;
  return `https://www.dropbox.com/oauth2/authorize?${new URLSearchParams(params).toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dropbox token exchange failed: ${errText}`);
  }

  const data = await res.json();
  const tokenData: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 300) * 1000,
  };

  cachedToken = tokenData;

  await supabase.from("company_settings").update({
    dropbox_refresh_token: data.refresh_token,
  }).eq("id", 1);

  return data.refresh_token;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  let refreshToken = cachedToken?.refresh_token;

  if (!refreshToken) {
    const { data } = await supabase
      .from("company_settings")
      .select("dropbox_refresh_token")
      .eq("id", 1)
      .single();
    refreshToken = data?.dropbox_refresh_token;
  }

  if (!refreshToken) {
    throw new Error("Dropbox not connected. Please authorize Dropbox in Settings.");
  }

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    cachedToken = null;
    throw new Error(`Dropbox token refresh failed: ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

export async function isDropboxConnected(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("company_settings")
      .select("dropbox_refresh_token")
      .eq("id", 1)
      .single();
    return !!(data?.dropbox_refresh_token);
  } catch {
    return false;
  }
}

export async function getDropboxAccountInfo(): Promise<{ name: string; email: string } | null> {
  try {
    const token = await getAccessToken();
    const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name?.display_name || "",
      email: data.email || "",
    };
  } catch {
    return null;
  }
}

export async function uploadToDropbox(
  fileBuffer: Buffer,
  dropboxPath: string
): Promise<{ path: string; id: string }> {
  const token = await getAccessToken();

  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: dropboxPath,
        mode: "add",
        autorename: true,
        mute: false,
      }),
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dropbox upload failed: ${errText}`);
  }

  const data = await res.json();
  return { path: data.path_display, id: data.id };
}

export async function downloadFromDropbox(dropboxPath: string): Promise<{ buffer: Buffer; name: string }> {
  const token = await getAccessToken();

  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath }),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dropbox download failed: ${errText}`);
  }

  const metadata = JSON.parse(res.headers.get("dropbox-api-result") || "{}");
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    name: metadata.name || "document",
  };
}

export async function deleteFromDropbox(dropboxPath: string): Promise<void> {
  const token = await getAccessToken();

  const res = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: dropboxPath }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dropbox delete failed: ${errText}`);
  }
}

export async function disconnectDropbox(): Promise<void> {
  try {
    const token = await getAccessToken();
    await fetch("https://api.dropboxapi.com/2/auth/token/revoke", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {}
  cachedToken = null;
  await supabase.from("company_settings").update({ dropbox_refresh_token: null }).eq("id", 1);
}
