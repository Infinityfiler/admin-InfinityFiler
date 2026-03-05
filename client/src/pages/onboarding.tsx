import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Upload, FileText, X, Plus, ShieldCheck, Loader2 } from "lucide-react";
import logoPath from "@assets/logo_1772131777440.png";
import { countries } from "@/lib/countries";

interface OnboardingService {
  id: number;
  name: string;
  category: string;
  type: string;
  state: string;
}

interface DocFile {
  file: File;
  docName: string;
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
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    };
    document.addEventListener("mousedown", listener, true);
    return () => document.removeEventListener("mousedown", listener, true);
  }, [ref, handler, active]);
}

export default function Onboarding() {
  const [form, setForm] = useState({
    company_name: "",
    individual_name: "",
    email: "",
    phone: "",
    country: "",
    state_province: "",
    residential_address: "",
    referred_by: "",
    notes: "",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [services, setServices] = useState<OnboardingService[]>([]);
  const [docFiles, setDocFiles] = useState<DocFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const docFileRef = useRef<HTMLInputElement>(null);

  const [countrySearch, setCountrySearch] = useState("");
  const [phoneCodeSearch, setPhoneCodeSearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState("");

  const closeCountryDropdown = useCallback(() => { setShowCountryDropdown(false); setCountrySearch(""); }, []);
  const closePhoneDropdown = useCallback(() => { setShowPhoneDropdown(false); setPhoneCodeSearch(""); }, []);
  useClickOutside(countryRef, closeCountryDropdown, showCountryDropdown);
  useClickOutside(phoneRef, closePhoneDropdown, showPhoneDropdown);

  const { dialCode: selectedDialCode, localNumber } = parsePhoneParts(form.phone);

  useEffect(() => {
    if (form.country) {
      const c = countries.find(c => c.name === form.country);
      if (c) setSelectedCountryCode(c.code);
    }
  }, [form.country]);

  useEffect(() => {
    if (!selectedDialCode) setSelectedCountryCode("");
    else if (selectedCountryCode) {
      const current = countries.find(c => c.code === selectedCountryCode);
      if (current && current.dialCode !== selectedDialCode) setSelectedCountryCode("");
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
    return countries.filter(c => c.name.toLowerCase().includes(s) || c.dialCode.includes(s));
  }, [phoneCodeSearch]);

  const handleCountrySelect = (name: string) => {
    const country = countries.find(c => c.name === name);
    if (country) {
      setSelectedCountryCode(country.code);
      const newPhone = localNumber ? `${country.dialCode} ${localNumber}` : country.dialCode;
      setForm({ ...form, country: name, phone: newPhone });
    } else {
      setForm({ ...form, country: name });
    }
    setCountrySearch("");
    setShowCountryDropdown(false);
  };

  const handlePhoneCodeSelect = (country: { code: string; dialCode: string }) => {
    setSelectedCountryCode(country.code);
    const newPhone = localNumber ? `${country.dialCode} ${localNumber}` : country.dialCode;
    setForm({ ...form, phone: newPhone });
    setPhoneCodeSearch("");
    setShowPhoneDropdown(false);
  };

  const handleLocalNumberChange = (value: string) => {
    const digitsOnly = value.replace(/[^\d]/g, "");
    if (selectedCountryInfo) {
      const maxDigits = getExpectedDigitCount(selectedCountryInfo.format, selectedDialCode);
      const trimmed = maxDigits > 0 ? digitsOnly.slice(0, maxDigits) : digitsOnly;
      setForm({ ...form, phone: `${selectedDialCode} ${trimmed}` });
    } else {
      setForm({ ...form, phone: digitsOnly });
    }
  };

  const localPlaceholder = selectedCountryInfo
    ? getLocalPlaceholder(selectedCountryInfo.format, selectedDialCode)
    : "Phone number";

  useEffect(() => {
    fetch("/api/onboarding/services")
      .then(r => r.json())
      .then(data => setServices(data))
      .catch(() => {});
  }, []);

  const servicesByCategory = useMemo(() => {
    const map: Record<string, OnboardingService[]> = {};
    services.forEach(s => {
      const key = s.category || "Other";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [services]);

  const toggleService = (serviceName: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceName)
        ? prev.filter(s => s !== serviceName)
        : [...prev, serviceName]
    );
  };

  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: DocFile[] = Array.from(files).map(f => ({
      file: f,
      docName: f.name.replace(/\.[^/.]+$/, ""),
    }));
    setDocFiles(prev => [...prev, ...newFiles]);
    if (docFileRef.current) docFileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!form.individual_name || !form.email || !form.phone) {
      setError("Please fill in all required fields (Name, Email, Phone)");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      const payload = {
        ...form,
        interested_services: selectedServices,
        doc_names: docFiles.map(f => f.docName),
      };
      formData.append("data", JSON.stringify(payload));
      docFiles.forEach(df => {
        formData.append("files", df.file);
      });

      const res = await fetch("/api/onboarding", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Submission failed" }));
        throw new Error(err.message);
      }

      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Thank You!</h2>
            <p className="text-muted-foreground">
              Your information has been submitted successfully. Our team will review your details and get in touch with you shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-8">
          <img src={logoPath} alt="Logo" className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-gray-200" />
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-onboarding-title">Customer Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">Please fill in your details to get started</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Personal Information</h3>

              <div>
                <Label>Company Name</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Your company name (if applicable)"
                  data-testid="input-onboarding-company_name"
                />
              </div>

              <div>
                <Label>Full Name *</Label>
                <Input
                  value={form.individual_name}
                  onChange={(e) => setForm({ ...form, individual_name: e.target.value })}
                  placeholder="Enter your full name"
                  data-testid="input-onboarding-individual_name"
                />
              </div>

              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                  data-testid="input-onboarding-email"
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
                  onFocus={() => { setShowCountryDropdown(true); setCountrySearch(""); }}
                  placeholder="Search country..."
                  data-testid="input-onboarding-country"
                />
                {showCountryDropdown && (
                  <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
                    {filteredCountries.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No countries found</div>
                    ) : (
                      filteredCountries.map(c => (
                        <button key={c.code} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer" onClick={() => handleCountrySelect(c.name)}>
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="relative" ref={phoneRef}>
                <Label>Phone Number *</Label>
                <div className="flex gap-2">
                  <div className="relative w-[220px] shrink-0">
                    <Input
                      value={showPhoneDropdown ? phoneCodeSearch : (selectedCountryInfo ? `${selectedDialCode} ${selectedCountryInfo.name}` : selectedDialCode || "")}
                      onChange={(e) => {
                        setPhoneCodeSearch(e.target.value);
                        if (!showPhoneDropdown) setShowPhoneDropdown(true);
                      }}
                      onFocus={() => { setShowPhoneDropdown(true); setPhoneCodeSearch(""); }}
                      placeholder="Country code"
                      className="text-sm"
                    />
                    {showPhoneDropdown && (
                      <div className="absolute z-50 w-[320px] mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
                        {filteredPhoneCodes.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">No codes found</div>
                        ) : (
                          filteredPhoneCodes.map(c => (
                            <button key={c.code + c.dialCode} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer" onClick={() => handlePhoneCodeSelect({ code: c.code, dialCode: c.dialCode })}>
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
                        <span className="flex items-center px-3 bg-muted border-r font-medium text-muted-foreground select-none shrink-0">{selectedDialCode}</span>
                        <input
                          className="flex-1 px-3 py-2 bg-transparent outline-none"
                          value={localNumber}
                          onChange={(e) => handleLocalNumberChange(e.target.value)}
                          placeholder={localPlaceholder.replace(/X/g, "0")}
                          data-testid="input-onboarding-phone"
                        />
                      </div>
                    ) : (
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="Phone number"
                        data-testid="input-onboarding-phone"
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
                  onChange={(e) => setForm({ ...form, state_province: e.target.value })}
                  data-testid="input-onboarding-state_province"
                />
              </div>

              <div>
                <Label>Residential Address</Label>
                <Input
                  value={form.residential_address}
                  onChange={(e) => setForm({ ...form, residential_address: e.target.value })}
                  data-testid="input-onboarding-residential_address"
                />
              </div>

              <div>
                <Label>Referred By</Label>
                <Input
                  value={form.referred_by}
                  onChange={(e) => setForm({ ...form, referred_by: e.target.value })}
                  placeholder="Name of person who referred you"
                  data-testid="input-onboarding-referred_by"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />Verification Documents
                  <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => docFileRef.current?.click()}
                  data-testid="button-onboarding-add-files"
                >
                  <Plus className="h-3 w-3 mr-1" />Add Files
                </Button>
                <input ref={docFileRef} type="file" multiple className="hidden" onChange={handleDocFileSelect} />
              </div>
              <p className="text-xs text-muted-foreground">Upload any verification documents (passport, ID, etc.)</p>

              {docFiles.length > 0 && (
                <div className="space-y-2">
                  {docFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded border">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input
                        value={f.docName}
                        onChange={(e) => setDocFiles(prev => prev.map((df, idx) => idx === i ? { ...df, docName: e.target.value } : df))}
                        className="h-7 text-xs flex-1"
                        placeholder="Document name (e.g. Passport)"
                      />
                      <span className="text-[10px] text-muted-foreground shrink-0">{(f.file.size / 1024).toFixed(0)} KB</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setDocFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">{docFiles.length} file(s) attached</p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Services of Interest</h3>
              <p className="text-xs text-muted-foreground">Select the services you're interested in</p>

              {Object.keys(servicesByCategory).length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading services...</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(servicesByCategory).map(([category, svcs]) => (
                    <div key={category}>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{category}</p>
                      <div className="flex flex-wrap gap-2">
                        {svcs.map(s => {
                          const label = s.state ? `${s.name} (${s.state})` : s.name;
                          const isSelected = selectedServices.includes(label);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleService(label)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-foreground border-border hover:bg-accent"
                              }`}
                              data-testid={`service-option-${s.id}`}
                            >
                              {isSelected && <CheckCircle2 className="h-3 w-3" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedServices.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedServices.length} service(s) selected</p>
              )}
            </div>

            <Separator />

            <div>
              <Label>Notes</Label>
              <textarea
                className="w-full rounded-md border p-2 text-sm bg-background"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional notes or questions..."
                data-testid="input-onboarding-notes"
              />
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-onboarding-error">
                {error}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || !form.individual_name || !form.email || !form.phone}
              className="w-full"
              size="lg"
              data-testid="button-onboarding-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : "Submit"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by Infinity Filer
        </p>
      </div>
    </div>
  );
}
