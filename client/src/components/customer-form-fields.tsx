import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { countries } from "@/lib/countries";
import { authFetch } from "@/lib/auth";
import type { ReferralPartner } from "@shared/schema";

interface CustomerFormData {
  company_name: string;
  individual_name: string;
  email: string;
  phone: string;
  country: string;
  state_province: string;
  residential_address: string;
  referred_by: string;
  referral_partner_id?: number | null;
  notes: string;
}

interface CustomerFormFieldsProps {
  form: CustomerFormData;
  onChange: (form: CustomerFormData) => void;
  testIdPrefix?: string;
}

function parsePhoneParts(phone: string): { dialCode: string; localNumber: string } {
  if (!phone) return { dialCode: "", localNumber: "" };
  const match = phone.match(/^(\+[\d-]+)\s+(.*)/);
  if (match) return { dialCode: match[1], localNumber: match[2] };
  const codeOnly = phone.match(/^(\+[\d-]+)$/);
  if (codeOnly) return { dialCode: codeOnly[1], localNumber: "" };
  return { dialCode: "", localNumber: phone };
}

function getLocalPlaceholder(format: string, dialCode: string): string {
  if (!format || !dialCode) return "Phone number";
  const cleanDial = dialCode.replace(/-/g, " ");
  let afterCode = format;
  if (afterCode.startsWith(cleanDial)) {
    afterCode = afterCode.slice(cleanDial.length).trim();
  } else {
    const parts = afterCode.split(" ");
    const dialParts = cleanDial.split(" ");
    afterCode = parts.slice(dialParts.length).join(" ");
  }
  return afterCode || "Phone number";
}

function getExpectedDigitCount(format: string, dialCode: string): number {
  const placeholder = getLocalPlaceholder(format, dialCode);
  return (placeholder.match(/X/g) || []).length;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener("mousedown", listener, true);
    return () => document.removeEventListener("mousedown", listener, true);
  }, [ref, handler, active]);
}

export default function CustomerFormFields({ form, onChange, testIdPrefix = "customer" }: CustomerFormFieldsProps) {
  const [countrySearch, setCountrySearch] = useState("");
  const [phoneCodeSearch, setPhoneCodeSearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);

  const closeCountryDropdown = useCallback(() => { setShowCountryDropdown(false); setCountrySearch(""); }, []);
  const closePhoneDropdown = useCallback(() => { setShowPhoneDropdown(false); setPhoneCodeSearch(""); }, []);

  useClickOutside(countryRef, closeCountryDropdown, showCountryDropdown);
  useClickOutside(phoneRef, closePhoneDropdown, showPhoneDropdown);
  const [selectedCountryCode, setSelectedCountryCode] = useState(() => {
    if (form.country) {
      const c = countries.find(c => c.name === form.country);
      if (c) return c.code;
    }
    return "";
  });

  const { dialCode: selectedDialCode, localNumber } = parsePhoneParts(form.phone);

  useEffect(() => {
    if (form.country) {
      const c = countries.find(c => c.name === form.country);
      if (c) setSelectedCountryCode(c.code);
    }
  }, [form.country]);

  useEffect(() => {
    if (!selectedDialCode) {
      setSelectedCountryCode("");
    } else if (selectedCountryCode) {
      const current = countries.find(c => c.code === selectedCountryCode);
      if (current && current.dialCode !== selectedDialCode) {
        setSelectedCountryCode("");
      }
    }
  }, [selectedDialCode]);

  const selectedCountryInfo = useMemo(() => {
    if (selectedCountryCode) {
      const byCode = countries.find(c => c.code === selectedCountryCode);
      if (byCode) return byCode;
    }
    if (!selectedDialCode) return null;
    return countries.find(c => c.dialCode === selectedDialCode) || null;
  }, [selectedDialCode, selectedCountryCode]);

  const filteredCountries = useMemo(() => {
    const s = countrySearch.toLowerCase();
    if (!s) return countries;
    return countries.filter(c => c.name.toLowerCase().includes(s));
  }, [countrySearch]);

  const filteredPhoneCodes = useMemo(() => {
    const s = phoneCodeSearch.toLowerCase();
    if (!s) return countries;
    return countries.filter(c =>
      c.name.toLowerCase().includes(s) || c.dialCode.includes(s)
    );
  }, [phoneCodeSearch]);

  const handleCountrySelect = (name: string) => {
    const country = countries.find(c => c.name === name);
    if (country) {
      setSelectedCountryCode(country.code);
      const newPhone = localNumber ? `${country.dialCode} ${localNumber}` : country.dialCode;
      onChange({ ...form, country: name, phone: newPhone });
    } else {
      onChange({ ...form, country: name });
    }
    setCountrySearch("");
    setShowCountryDropdown(false);
  };

  const handlePhoneCodeSelect = (country: { code: string; dialCode: string }) => {
    setSelectedCountryCode(country.code);
    const newPhone = localNumber ? `${country.dialCode} ${localNumber}` : country.dialCode;
    onChange({ ...form, phone: newPhone });
    setPhoneCodeSearch("");
    setShowPhoneDropdown(false);
  };

  const handleLocalNumberChange = (value: string) => {
    const digitsOnly = value.replace(/[^\d]/g, "");
    if (selectedCountryInfo) {
      const maxDigits = getExpectedDigitCount(selectedCountryInfo.format, selectedDialCode);
      const trimmed = maxDigits > 0 ? digitsOnly.slice(0, maxDigits) : digitsOnly;
      onChange({ ...form, phone: `${selectedDialCode} ${trimmed}` });
    } else {
      onChange({ ...form, phone: digitsOnly });
    }
  };

  const localPlaceholder = selectedCountryInfo
    ? getLocalPlaceholder(selectedCountryInfo.format, selectedDialCode)
    : "Phone number";

  return (
    <div className="space-y-4">
      <div>
        <Label>Company Name</Label>
        <Input
          value={form.company_name}
          onChange={(e) => onChange({ ...form, company_name: e.target.value })}
          data-testid={`input-${testIdPrefix}-company_name`}
        />
      </div>

      <div>
        <Label>Individual Name *</Label>
        <Input
          value={form.individual_name}
          onChange={(e) => onChange({ ...form, individual_name: e.target.value })}
          data-testid={`input-${testIdPrefix}-individual_name`}
        />
      </div>

      <div>
        <Label>Email *</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          data-testid={`input-${testIdPrefix}-email`}
        />
      </div>

      <div className="relative" ref={countryRef}>
        <Label>Country of Citizenship</Label>
        <Input
          value={showCountryDropdown ? countrySearch : form.country}
          onChange={(e) => {
            setCountrySearch(e.target.value);
            if (!showCountryDropdown) setShowCountryDropdown(true);
          }}
          onFocus={() => {
            setShowCountryDropdown(true);
            setCountrySearch("");
          }}
          placeholder="Search country..."
          data-testid={`input-${testIdPrefix}-country`}
        />
        {showCountryDropdown && (
          <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
            {filteredCountries.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">No countries found</div>
            ) : (
              filteredCountries.map(c => (
                <button
                  key={c.code}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                  onClick={() => handleCountrySelect(c.name)}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="relative" ref={phoneRef}>
        <Label>Personal Contact Number *</Label>
        <div className="flex gap-2">
          <div className="relative w-[220px] shrink-0">
            <Input
              value={showPhoneDropdown ? phoneCodeSearch : (selectedCountryInfo ? `${selectedDialCode} ${selectedCountryInfo.name}` : selectedDialCode || "")}
              onChange={(e) => {
                setPhoneCodeSearch(e.target.value);
                if (!showPhoneDropdown) setShowPhoneDropdown(true);
              }}
              onFocus={() => {
                setShowPhoneDropdown(true);
                setPhoneCodeSearch("");
              }}
              placeholder="Country code"
              className="text-sm"
            />
            {showPhoneDropdown && (
              <div className="absolute z-50 w-[320px] mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
                {filteredPhoneCodes.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No codes found</div>
                ) : (
                  filteredPhoneCodes.map(c => (
                    <button
                      key={c.code + c.dialCode}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                      onClick={() => handlePhoneCodeSelect({ code: c.code, dialCode: c.dialCode })}
                    >
                      <span className="font-medium">{c.dialCode}</span>
                      <span className="ml-2 text-muted-foreground">{c.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex-1 flex items-center">
            {selectedDialCode ? (
              <div className="flex h-10 w-full rounded-md border bg-background text-sm overflow-hidden">
                <span className="flex items-center px-3 bg-muted border-r font-medium text-muted-foreground select-none shrink-0">
                  {selectedDialCode}
                </span>
                <input
                  className="flex-1 px-3 py-2 bg-transparent outline-none"
                  value={localNumber}
                  onChange={(e) => handleLocalNumberChange(e.target.value)}
                  placeholder={localPlaceholder.replace(/X/g, "0")}
                  data-testid={`input-${testIdPrefix}-phone`}
                />
              </div>
            ) : (
              <Input
                value={form.phone}
                onChange={(e) => onChange({ ...form, phone: e.target.value })}
                placeholder="Phone number"
                data-testid={`input-${testIdPrefix}-phone`}
              />
            )}
          </div>
        </div>
        {selectedCountryInfo && (
          <p className="text-xs text-muted-foreground mt-1">
            Format: {selectedCountryInfo.format}
            {getExpectedDigitCount(selectedCountryInfo.format, selectedDialCode) > 0 && (
              <span className="ml-2">({getExpectedDigitCount(selectedCountryInfo.format, selectedDialCode)} digits)</span>
            )}
          </p>
        )}
      </div>

      <div>
        <Label>State/Province</Label>
        <Input
          value={form.state_province}
          onChange={(e) => onChange({ ...form, state_province: e.target.value })}
          data-testid={`input-${testIdPrefix}-state_province`}
        />
      </div>

      <div>
        <Label>Residential Address</Label>
        <Input
          value={form.residential_address}
          onChange={(e) => onChange({ ...form, residential_address: e.target.value })}
          data-testid={`input-${testIdPrefix}-residential_address`}
        />
      </div>

      <ReferralPartnerField
        form={form}
        onChange={onChange}
        testIdPrefix={testIdPrefix}
      />

      <div>
        <Label>Notes</Label>
        <textarea
          className="w-full rounded-md border p-2 text-sm bg-background"
          rows={3}
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          data-testid={`input-${testIdPrefix}-notes`}
        />
      </div>
    </div>
  );
}

function ReferralPartnerField({ form, onChange, testIdPrefix }: { form: CustomerFormData; onChange: (f: CustomerFormData) => void; testIdPrefix: string }) {
  const [referralSearch, setReferralSearch] = useState("");
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<ReferralPartner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<ReferralPartner | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const referralRef = useRef<HTMLDivElement>(null);

  const closeReferralDropdown = useCallback(() => { setShowReferralDropdown(false); setReferralSearch(""); }, []);
  useClickOutside(referralRef, closeReferralDropdown, showReferralDropdown);

  useEffect(() => {
    if (form.referral_partner_id && !selectedPartner) {
      authFetch(`/api/referral-partners/${form.referral_partner_id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setSelectedPartner(data); })
        .catch(() => {});
    }
  }, [form.referral_partner_id]);

  useEffect(() => {
    if (!referralSearch || referralSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      authFetch(`/api/referral-partners/search?q=${encodeURIComponent(referralSearch)}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setSearchResults(data); setIsSearching(false); })
        .catch(() => { setSearchResults([]); setIsSearching(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [referralSearch]);

  const handleSelectPartner = (partner: any) => {
    setSelectedPartner(partner);
    onChange({
      ...form,
      referred_by: partner.full_name,
      referral_partner_id: partner.id > 0 ? partner.id : null,
    });
    setReferralSearch("");
    setShowReferralDropdown(false);
  };

  const handleClearPartner = () => {
    setSelectedPartner(null);
    onChange({
      ...form,
      referred_by: "",
      referral_partner_id: null,
    });
  };

  return (
    <div className="relative" ref={referralRef}>
      <Label>Referred By</Label>
      {selectedPartner ? (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{selectedPartner.full_name}</span>
            {selectedPartner.username && <span className="text-xs text-muted-foreground ml-2">@{selectedPartner.username}</span>}
            {selectedPartner.referral_code && <Badge variant="outline" className="ml-2 text-[10px] font-mono">{selectedPartner.referral_code}</Badge>}
          </div>
          <button
            type="button"
            className="text-xs text-destructive hover:underline shrink-0"
            onClick={handleClearPartner}
            data-testid={`button-${testIdPrefix}-clear-referral`}
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <Input
            value={showReferralDropdown ? referralSearch : form.referred_by}
            onChange={(e) => {
              const val = e.target.value;
              setReferralSearch(val);
              onChange({ ...form, referred_by: val });
              if (!showReferralDropdown) setShowReferralDropdown(true);
            }}
            onFocus={() => {
              setShowReferralDropdown(true);
              setReferralSearch(form.referred_by || "");
            }}
            placeholder="Search by name, username, or referral code..."
            data-testid={`input-${testIdPrefix}-referred_by`}
          />
          {showReferralDropdown && referralSearch.length >= 2 && (
            <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
              {isSearching ? (
                <div className="p-2 text-sm text-muted-foreground">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No matching partners found. The text will be saved as-is.</div>
              ) : (
                searchResults.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                    onClick={() => handleSelectPartner(p)}
                    data-testid={`option-referral-${p.id}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.full_name}</span>
                      {p.username && <span className="text-muted-foreground">@{p.username}</span>}
                      {p.referral_code && <Badge variant="outline" className="text-[10px] font-mono">{p.referral_code}</Badge>}
                      <Badge variant="secondary" className="text-[10px] capitalize">{p._is_customer ? "customer" : (p.type || "partner")}</Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
