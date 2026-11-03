"use client";

import { useState, useEffect, useRef } from "react";
import { BRANCHES } from "../data/branches";
import { SKILLS_BY_CATEGORY } from "../data/skills";

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const GOALS = [
  "Software Engineer",
  "Data Scientist / ML Engineer",
  "Core / Hardware Engineer",
  "DevOps / Cloud Engineer",
  "Cybersecurity Analyst",
  "Research / Higher Studies",
  "Entrepreneur / Startup",
];

const CATEGORIES = [
  { id: "Hackathon", label: "Hackathons" },
  { id: "Internship", label: "Internships" },
  { id: "Certification", label: "Certifications" },
];

export default function Home() {
  const [branch, setBranch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const [year, setYear] = useState("");

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);

  const [goal, setGoal] = useState("");

  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "Hackathon",
    "Internship",
    "Certification",
  ]);

  const [mode, setMode] = useState("Any");
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("Free only");

  const [status, setStatus] = useState<"idle" | "searching" | "verifying" | "done">("idle");
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [queriesUsed, setQueriesUsed] = useState<string[]>([]);
  const [actionStatuses, setActionStatuses] = useState<{ [key: string]: string }>({});
  const [emailToSave, setEmailToSave] = useState("");
  const [savedEmailSuccess, setSavedEmailSuccess] = useState(false);
  const [savedOpportunities, setSavedOpportunities] = useState<any[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  const branchRef = useRef<HTMLDivElement>(null);
  const skillRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node))
        setShowBranchDropdown(false);
      if (skillRef.current && !skillRef.current.contains(e.target as Node))
        setShowSkillDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const savedStatus = localStorage.getItem("radar_action_statuses");
    if (savedStatus) {
      try {
        setActionStatuses(JSON.parse(savedStatus));
      } catch (e) {
        console.error("Failed to parse local storage", e);
      }
    }

    const savedOpps = localStorage.getItem("savedOpportunities");
    if (savedOpps) {
      try {
        setSavedOpportunities(JSON.parse(savedOpps));
      } catch (e) {
        console.error("Failed to parse saved opportunities", e);
      }
    }

    const savedEmail = localStorage.getItem("radar_email");
    if (savedEmail) {
      setEmailToSave(savedEmail);
      setSavedEmailSuccess(true);
    }
  }, []);

  const filteredBranches = BRANCHES.filter((b) =>
    b.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const filteredSkills = Object.entries(SKILLS_BY_CATEGORY)
    .map(([category, skills]) => ({
      category,
      skills: skills.filter(
        (s) =>
          s.toLowerCase().includes(skillSearch.toLowerCase()) &&
          !selectedSkills.includes(s)
      ),
    }))
    .filter((g) => g.skills.length > 0);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
    });
  };

  const removeSkill = (skill: string) => {
    setSelectedSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!branch || !year || selectedSkills.length === 0 || !goal) return;

    setStatus("searching");
    setOpportunities([]);
    setQueriesUsed([]);
    setSavedEmailSuccess(false);

    const verifyingTimer = setTimeout(() => setStatus("verifying"), 4000);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/v1/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          year,
          interests: selectedSkills.join(", "),
          goal,
          categories: selectedCategories,
          mode: selectedCategories.includes("Internship") ? mode : "Any",
          city: selectedCategories.includes("Internship") ? city : "",
          budget: selectedCategories.includes("Certification") ? budget : "Any",
        }),
      });

      if (response.status === 429) {
        const errData = await response.json();
        alert(errData.detail?.error || "Rate limited. Please wait a few moments before searching again.");
        setStatus("idle");
        return;
      }

      const data = await response.json();
      setOpportunities(data.opportunities || []);
      setQueriesUsed(data.queries_used || []);
    } catch (error) {
      console.error("Failed to fetch opportunities:", error);
    } finally {
      clearTimeout(verifyingTimer);
      setStatus((prev) => (prev !== "idle" ? "done" : "idle"));
    }
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const fetchSavedOpportunities = async (email: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/v1/saved-opportunities?email=${email}`);
      if (response.ok) {
        const opps = await response.json();
        setSavedOpportunities(opps.filter((o: any) => o.status === "saved"));

        const statuses: { [key: string]: string } = {};
        opps.forEach((o: any) => {
          statuses[o.name] = o.status;
        });
        setActionStatuses((prev) => ({ ...prev, ...statuses }));
      }
    } catch (e) {
      console.error("Failed to fetch saved opportunities", e);
    }
  };

  const updateStatus = async (opp: any, newStatus: string) => {
    const isLocalOnly =
      newStatus === "rejected" ||
      (!newStatus && actionStatuses[opp.name] === "rejected");

    const updated = { ...actionStatuses, [opp.name]: newStatus };
    setActionStatuses(updated);
    localStorage.setItem("radar_action_statuses", JSON.stringify(updated));

    if (emailToSave && isValidEmail(emailToSave) && !isLocalOnly) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        await fetch(`${apiUrl}/api/v1/save-opportunity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailToSave,
            url: opp.link,
            status: newStatus || "new",
          }),
        });
      } catch (error) {
        const rollback = { ...actionStatuses };
        setActionStatuses(rollback);
        console.error("Save failed:", error);
      }
    }
  };

  const handleSaveOpp = async (opp: any) => {
    const isCurrentlySaved = actionStatuses[opp.name] === "saved";
    const newStatus = isCurrentlySaved ? "" : "saved";

    await updateStatus(opp, newStatus);

    let updatedSaved = [...savedOpportunities];
    if (newStatus === "saved") {
      if (!updatedSaved.some((o) => o.name === opp.name)) {
        updatedSaved.push(opp);
      }
    } else {
      updatedSaved = updatedSaved.filter((o) => o.name !== opp.name);
    }
    setSavedOpportunities(updatedSaved);
    localStorage.setItem("savedOpportunities", JSON.stringify(updatedSaved));
  };

  const handleSaveEmail = async () => {
    if (emailToSave && isValidEmail(emailToSave)) {
      setSavedEmailSuccess(true);
      localStorage.setItem("radar_email", emailToSave);

      if (savedOpportunities.length > 0) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          await Promise.all(
            savedOpportunities.map((opp) =>
              fetch(`${apiUrl}/api/v1/save-opportunity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: emailToSave,
                  url: opp.link,
                  status: "saved",
                }),
              })
            )
          );
        } catch (e) {
          console.error("Failed to sync local saves", e);
        }
        
        handleTriggerEmail(emailToSave);
      }

      fetchSavedOpportunities(emailToSave);
    } else {
      alert("Please enter a valid email address.");
    }
  };

  const handleTriggerEmail = async (emailAddr: string) => {
    if (!emailAddr || !isValidEmail(emailAddr)) return;
    setIsSendingEmail(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/v1/send-saved-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddr }),
      });
      if (res.ok) {
        alert("Saved opportunities have been sent to your email.");
      } else {
        const errorData = await res.json();
        alert(`Failed to send email: ${errorData.detail || "Unknown error"}`);
      }
    } catch (e) {
      console.error("Failed to trigger email", e);
      alert("Failed to send email. Check your connection.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const isFormValid = Boolean(branch && year && selectedSkills.length > 0 && goal);
  const isLoading = status === "searching" || status === "verifying";

  // Visible opportunities filter (exclude rejected)
  const visibleOpportunities = opportunities.filter(
    (o) => actionStatuses[o.name] !== "rejected"
  );

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* ── Top Navigation Bar ── */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/90 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="font-semibold text-sm tracking-tight text-white">Radar</span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded">
                1waygo
              </span>
            </div>
            <span className="text-[var(--border-strong)]">/</span>
            <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
              Student Opportunity Discovery
            </span>
          </div>

          <div className="flex items-center gap-3">
            {savedOpportunities.length > 0 && (
              <button
                onClick={() => setShowSaved(!showSaved)}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 ${
                  showSaved
                    ? "bg-[var(--bg-surface-elevated)] border-[var(--text-secondary)] text-white"
                    : "bg-transparent border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-hover)]"
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>Saved ({savedOpportunities.length})</span>
              </button>
            )}

            <a
              href="https://github.com/FLITXCOV/opportunity-radar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1 px-2 py-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">

          {/* ── LEFT: Filters / Form ── */}
          <aside className="surface-card p-5 lg:sticky lg:top-20">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">Search Filters</h2>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Define your background & criteria</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                v2.1
              </span>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              {/* Branch */}
              <div ref={branchRef} className="relative">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Academic Branch
                </label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science..."
                  className="input-base w-full px-3 py-2 text-sm"
                  value={branch || branchSearch}
                  onChange={(e) => {
                    setBranchSearch(e.target.value);
                    setBranch("");
                    setShowBranchDropdown(true);
                  }}
                  onFocus={() => setShowBranchDropdown(true)}
                />
                {showBranchDropdown && filteredBranches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] shadow-xl">
                    {filteredBranches.map((b) => (
                      <div
                        key={b}
                        className="px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                        onClick={() => {
                          setBranch(b);
                          setBranchSearch(b);
                          setShowBranchDropdown(false);
                        }}
                      >
                        {b}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Year */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Year of Study
                </label>
                <select
                  className="input-base w-full px-3 py-2 text-sm"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">Select year...</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y} className="bg-[var(--bg-surface)]">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills */}
              <div ref={skillRef} className="relative">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Skills & Technologies
                </label>

                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedSkills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSkill(s)}
                          className="hover:text-red-400 text-[var(--text-tertiary)] ml-0.5 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Type to add skills..."
                  className="input-base w-full px-3 py-2 text-sm"
                  value={skillSearch}
                  onChange={(e) => {
                    setSkillSearch(e.target.value);
                    setShowSkillDropdown(true);
                  }}
                  onFocus={() => setShowSkillDropdown(true)}
                />

                {showSkillDropdown && filteredSkills.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] shadow-xl">
                    {filteredSkills.map(({ category, skills }) => (
                      <div key={category} className="border-b border-[var(--border-subtle)] last:border-0">
                        <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-subtle)] sticky top-0">
                          {category}
                        </div>
                        {skills.map((s) => (
                          <div
                            key={s}
                            className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                            onClick={() => {
                              setSelectedSkills((prev) => [...prev, s]);
                              setSkillSearch("");
                              setShowSkillDropdown(false);
                            }}
                          >
                            + {s}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Career Goal */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Career Track Target
                </label>
                <select
                  className="input-base w-full px-3 py-2 text-sm"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                >
                  <option value="">Select track...</option>
                  {GOALS.map((g) => (
                    <option key={g} value={g} className="bg-[var(--bg-surface)]">
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opportunity Type Toggles */}
              <div className="pt-2 border-t border-[var(--border-subtle)]">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Opportunity Types
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map(({ id, label }) => {
                    const active = selectedCategories.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleCategory(id)}
                        className={`filter-chip py-1.5 px-2 text-center text-xs truncate ${
                          active ? "active" : ""
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Additional parameters if Internship / Certification is selected */}
              {selectedCategories.includes("Internship") && (
                <div className="pt-2 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[var(--text-tertiary)] mb-1">
                      Internship Mode
                    </label>
                    <select
                      className="input-base w-full px-2.5 py-1.5 text-xs"
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option>Any</option>
                      <option>Remote</option>
                      <option>On-site</option>
                      <option>Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-tertiary)] mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bangalore"
                      className="input-base w-full px-2.5 py-1.5 text-xs"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedCategories.includes("Certification") && (
                <div>
                  <label className="block text-[11px] text-[var(--text-tertiary)] mb-1">
                    Certification Cost
                  </label>
                  <select
                    className="input-base w-full px-2.5 py-1.5 text-xs"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  >
                    <option>Free only</option>
                    <option>Paid ok</option>
                  </select>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="btn-primary w-full py-2.5 text-sm mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4 text-black" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{status === "searching" ? "Searching indexes..." : "Verifying links..."}</span>
                  </span>
                ) : (
                  "Find Opportunities"
                )}
              </button>
            </form>
          </aside>

          {/* ── RIGHT: Results Pane ── */}
          <main className="space-y-6">

            {/* ── Saved Opportunities View (When Opened) ── */}
            {showSaved && (
              <section className="surface-card p-5 border-amber-500/20 bg-amber-500/[0.02]">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-white">Saved Opportunities ({savedOpportunities.length})</h3>
                  </div>
                  <button
                    onClick={() => setShowSaved(false)}
                    className="text-xs text-[var(--text-tertiary)] hover:text-white"
                  >
                    Close
                  </button>
                </div>

                {savedOpportunities.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] py-4 text-center">
                    No saved opportunities yet. Click &quot;Save&quot; on any card below.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {savedOpportunities.map((opp, idx) => (
                      <div
                        key={`saved-${idx}`}
                        className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg p-3.5 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                              {opp.type}
                            </span>
                            <span className="font-medium text-white truncate">{opp.name}</span>
                          </div>
                          <p className="text-[11px] text-[var(--text-tertiary)] mt-1 truncate">
                            {opp.organization ? `${opp.organization} · ` : ""}Deadline: {opp.deadline}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleSaveOpp(opp)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                          >
                            Remove
                          </button>
                          <a
                            href={opp.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs px-2.5 py-1"
                          >
                            Apply ↗
                          </a>
                        </div>
                      </div>
                    ))}

                    {/* Email Digest Trigger */}
                    <div className="pt-3 mt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-left w-full sm:w-auto">
                        <p className="text-xs font-medium text-white">Send to Email</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">
                          Export these saved opportunities to your inbox.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="email"
                          placeholder="Your email address"
                          className="input-base px-2.5 py-1 text-xs w-full sm:w-56"
                          value={emailToSave}
                          onChange={(e) => setEmailToSave(e.target.value)}
                        />
                        <button
                          onClick={handleSaveEmail}
                          disabled={!emailToSave || isSendingEmail}
                          className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                        >
                          {isSendingEmail ? "Sending..." : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Idle State (Before Search) ── */}
            {status === "idle" && (
              <div className="surface-card p-10 text-center flex flex-col items-center justify-center min-h-[380px]">
                <div className="w-10 h-10 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] mb-4">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">Radar Ready</h3>
                <p className="text-xs text-[var(--text-tertiary)] max-w-sm leading-relaxed mb-4">
                  Select your academic branch, year, and target career track on the left to scan live, verified hackathons, internships, and certifications.
                </p>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-disabled)]">
                  <span>Backend: Render</span>
                  <span>•</span>
                  <span>Engine: Gemini AI + Live Web</span>
                </div>
              </div>
            )}

            {/* ── Loading State ── */}
            {isLoading && (
              <div className="surface-card p-10 text-center flex flex-col items-center justify-center min-h-[380px]">
                <div className="relative mb-5">
                  <svg className="animate-spin w-6 h-6 text-[var(--text-secondary)]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-white mb-1 font-mono">
                  {status === "searching" ? "Querying Opportunity Indexes..." : "Validating Application Links..."}
                </h3>
                <p className="text-xs text-[var(--text-tertiary)] max-w-sm">
                  {status === "searching"
                    ? "Searching verified platforms for current deadlines matching your skills."
                    : "Pinging URLs and eliminating expired postings."}
                </p>
              </div>
            )}

            {/* ── Empty Results State ── */}
            {status === "done" && visibleOpportunities.length === 0 && (
              <div className="surface-card p-10 text-center">
                <p className="text-sm font-medium text-white mb-1">No active listings found</p>
                <p className="text-xs text-[var(--text-tertiary)] max-w-md mx-auto mb-4">
                  No verified opportunities currently matched this specific filter combination. Try selecting additional skills or broadening your preferences.
                </p>
              </div>
            )}

            {/* ── Results Header ── */}
            {status === "done" && visibleOpportunities.length > 0 && (
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-xs font-semibold text-white">
                    {visibleOpportunities.length} Verified Match{visibleOpportunities.length === 1 ? "" : "es"}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[var(--text-tertiary)]">
                  {selectedCategories.join(" · ")}
                </div>
              </div>
            )}

            {/* ── Search Execution Log (Technical Drawer) ── */}
            {status === "done" && queriesUsed.length > 0 && (
              <details className="text-xs text-[var(--text-tertiary)] border border-[var(--border-subtle)] rounded-lg p-3 bg-[var(--bg-subtle)] cursor-pointer">
                <summary className="font-mono text-[11px] text-[var(--text-secondary)] select-none">
                  Search Query Diagnostics ({queriesUsed.length} queries)
                </summary>
                <div className="mt-2 space-y-1 font-mono text-[11px] text-[var(--text-tertiary)]">
                  {queriesUsed.map((q, i) => (
                    <div key={i} className="truncate">
                      <span className="text-[var(--text-disabled)] mr-2">{i + 1}.</span>
                      {q}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* ── Opportunity Cards List ── */}
            {status === "done" && (
              <div className="space-y-4">
                {visibleOpportunities.map((opp, idx) => {
                  const isSaved = actionStatuses[opp.name] === "saved";
                  const isApplied = actionStatuses[opp.name] === "applied";

                  return (
                    <article
                      key={idx}
                      className="surface-card p-5 relative transition-all"
                    >
                      {/* Top Meta row */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            {opp.type}
                          </span>
                          {opp.organization && (
                            <span className="text-xs text-[var(--text-secondary)] font-medium">
                              {opp.organization}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-tertiary)]">
                          <span>Deadline:</span>
                          <span className="text-[var(--text-secondary)]">{opp.deadline || "Open"}</span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-white tracking-tight mb-2">
                        {opp.name}
                      </h3>

                      {/* Description */}
                      {opp.description && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                          {opp.description}
                        </p>
                      )}

                      {/* Time commitment */}
                      {opp.time_commitment && (
                        <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5 mb-3">
                          <span className="text-[var(--text-disabled)]">Commitment:</span>
                          <span>{opp.time_commitment}</span>
                        </div>
                      )}

                      {/* Why it matches (Clean, honest explanation) */}
                      {opp.reason && (
                        <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] mb-4">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">
                            Match Reason
                          </span>
                          <p className="leading-relaxed">{opp.reason}</p>
                        </div>
                      )}

                      {/* Actions Footer */}
                      <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          {/* Save toggle */}
                          <button
                            onClick={() => handleSaveOpp(opp)}
                            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                              isSaved
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-hover)]"
                            }`}
                          >
                            {isSaved ? "Saved ✓" : "Save"}
                          </button>

                          {/* Applied toggle */}
                          <button
                            onClick={() =>
                              updateStatus(opp, isApplied ? "" : "applied")
                            }
                            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                              isApplied
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-hover)]"
                            }`}
                          >
                            {isApplied ? "Applied ✓" : "Mark Applied"}
                          </button>

                          {/* Hide button */}
                          <button
                            onClick={() => updateStatus(opp, "rejected")}
                            className="text-xs px-2 py-1 text-[var(--text-disabled)] hover:text-red-400 transition-colors"
                            title="Hide from list"
                          >
                            Hide
                          </button>
                        </div>

                        {/* Direct application link */}
                        <a
                          href={opp.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs px-3 py-1.5 font-medium flex items-center gap-1.5"
                        >
                          <span>Apply</span>
                          <svg className="w-3 h-3 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-16 pt-6 border-t border-[var(--border-subtle)] text-center text-xs text-[var(--text-tertiary)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-white font-medium">1waygo</span>
            <span>·</span>
            <span>Built by Anderson</span>
          </div>
          <p className="font-mono text-[11px] text-[var(--text-disabled)]">
            Verified realtime data powered by Gemini &amp; Tavily Search
          </p>
        </footer>
      </div>
    </div>
  );
}
