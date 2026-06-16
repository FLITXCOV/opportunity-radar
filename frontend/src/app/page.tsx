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
  { id: "Hackathon", label: "Hackathon", icon: "🏆" },
  { id: "Internship", label: "Internship", icon: "💼" },
  { id: "Certification", label: "Certification", icon: "📜" },
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
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
        alert(errData.detail?.error || "Rate limited! Please wait a moment.");
        setStatus("idle");
        return;
      }

      const data = await response.json();
      setOpportunities(data.opportunities || []);
      setQueriesUsed(data.queries_used || []);
    } catch (error) {
      console.error("Failed to fetch", error);
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

  const handleSaveEmail = () => {
    if (emailToSave && isValidEmail(emailToSave)) {
      setSavedEmailSuccess(true);
      fetchSavedOpportunities(emailToSave);
      localStorage.setItem("radar_email", emailToSave);

      if (savedOpportunities.length > 0) {
        handleTriggerEmail(emailToSave);
      }
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
        alert("Success! Your saved opportunities have been sent to your email.");
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

  const categoryIcons: { [key: string]: string } = {
    Hackathon: "🏆",
    Internship: "💼",
    Certification: "📜",
  };

  const isFormValid = branch && year && selectedSkills.length > 0 && goal;
  const isLoading = status === "searching" || status === "verifying";

  return (
    <div className="relative min-h-screen text-[var(--text-primary)] selection:bg-indigo-500/30 selection:text-white" style={{ background: 'var(--bg-primary)' }}>
      {/* Ambient glow handled by body::after in CSS */}

      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 py-10 md:py-20">

        {/* ── HEADER ── */}
        <header className="mb-14 md:mb-20">
          <h1 className="text-5xl md:text-7xl lg:text-8xl tracking-tight leading-none">
            <span className="font-extralight text-[var(--text-secondary)]">1</span>
            <span className="font-bold bg-gradient-to-r from-indigo-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">waygo</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm md:text-base mt-3 max-w-lg tracking-wide">
            AI-curated opportunities matched to your exact profile.
          </p>
        </header>

        {/* ── MAIN GRID ── */}
        <div className="grid md:grid-cols-[360px_1fr] gap-8 md:gap-12">

          {/* ─── LEFT: PROFILE FORM ─── */}
          <aside className="glass-panel rounded-2xl p-6 md:p-7 h-fit sticky top-8">
            <h2 className="text-lg font-semibold tracking-tight mb-6 text-[var(--text-primary)]">
              Your Profile
            </h2>

            <div className="space-y-5">

              {/* BRANCH */}
              <div ref={branchRef} className="relative">
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">
                  Branch
                </label>
                <input
                  type="text"
                  placeholder="Search your branch..."
                  className="input-field w-full rounded-lg px-3.5 py-2.5 text-sm"
                  value={branch || branchSearch}
                  onChange={(e) => {
                    setBranchSearch(e.target.value);
                    setBranch("");
                    setShowBranchDropdown(true);
                  }}
                  onFocus={() => setShowBranchDropdown(true)}
                />
                {showBranchDropdown && filteredBranches.length > 0 && (
                  <div className="dropdown-menu absolute z-20 mt-1.5 w-full max-h-48 overflow-y-auto rounded-lg">
                    {filteredBranches.map((b) => (
                      <div
                        key={b}
                        className="dropdown-item px-3.5 py-2 text-sm text-[var(--text-secondary)] cursor-pointer"
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

              {/* YEAR */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">
                  Year
                </label>
                <select
                  className="input-field w-full rounded-lg px-3.5 py-2.5 text-sm appearance-none"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">Select Year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* SKILLS */}
              <div ref={skillRef} className="relative">
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">
                  Skills &amp; Interests
                </label>

                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedSkills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border"
                        style={{
                          background: 'rgba(99, 102, 241, 0.08)',
                          borderColor: 'rgba(99, 102, 241, 0.2)',
                          color: 'var(--accent-indigo)',
                        }}
                      >
                        {s}
                        <button
                          onClick={() => removeSkill(s)}
                          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Search skills (e.g. Machine Learning)"
                  className="input-field w-full rounded-lg px-3.5 py-2.5 text-sm"
                  value={skillSearch}
                  onChange={(e) => {
                    setSkillSearch(e.target.value);
                    setShowSkillDropdown(true);
                  }}
                  onFocus={() => setShowSkillDropdown(true)}
                />

                {showSkillDropdown && filteredSkills.length > 0 && (
                  <div className="dropdown-menu absolute z-20 mt-1.5 w-full max-h-60 overflow-y-auto rounded-lg">
                    {filteredSkills.map(({ category, skills }) => (
                      <div key={category}>
                        <div className="px-3.5 py-1.5 text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-[0.15em] sticky top-0 bg-[var(--bg-primary)]">
                          {category}
                        </div>
                        {skills.map((s) => (
                          <div
                            key={s}
                            className="dropdown-item px-3.5 py-2 text-sm text-[var(--text-secondary)] cursor-pointer"
                            onClick={() => {
                              setSelectedSkills((prev) => [...prev, s]);
                              setSkillSearch("");
                              setShowSkillDropdown(false);
                            }}
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CAREER GOAL */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">
                  Career Goal
                </label>
                <select
                  className="input-field w-full rounded-lg px-3.5 py-2.5 text-sm appearance-none"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                >
                  <option value="">Select Goal</option>
                  {GOALS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* DIVIDER */}
              <div className="border-t border-[var(--border-subtle)]" />

              {/* CATEGORY TOGGLES */}
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-2.5 uppercase tracking-widest">
                  Looking for
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleCategory(id)}
                      className={`pill-toggle px-4 py-2 rounded-full text-xs font-semibold tracking-wide ${
                        selectedCategories.includes(id) ? "active" : ""
                      }`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CONDITIONAL PREFERENCES */}
              {(selectedCategories.includes("Internship") ||
                selectedCategories.includes("Certification")) && (
                <div className="space-y-3 pt-1 fade-in">
                  <p className="text-[10px] font-semibold text-[var(--text-ghost)] uppercase tracking-[0.15em]">
                    Preferences{" "}
                    <span className="font-normal normal-case text-[var(--text-ghost)]">(optional)</span>
                  </p>

                  {selectedCategories.includes("Internship") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                          Mode
                        </label>
                        <select
                          className="input-field w-full rounded-lg px-3 py-2 text-sm appearance-none"
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
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Chennai"
                          className="input-field w-full rounded-lg px-3 py-2 text-sm"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedCategories.includes("Certification") && (
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                        Budget
                      </label>
                      <select
                        className="input-field w-full rounded-lg px-3 py-2 text-sm appearance-none"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                      >
                        <option>Free only</option>
                        <option>Paid ok</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* SUBMIT */}
              <button
                onClick={handleSearch}
                disabled={isLoading || !isFormValid}
                className="btn-tactile btn-primary w-full mt-2 py-3.5 px-4 rounded-xl text-sm tracking-wide"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="loader-dot" />
                    <span className="loader-dot" />
                    <span className="loader-dot" />
                    <span className="ml-1">Agent working</span>
                  </span>
                ) : (
                  "Find Opportunities"
                )}
              </button>
            </div>
          </aside>

          {/* ─── RIGHT: RESULTS ─── */}
          <main className="space-y-5 min-w-0">

            {/* Saved Toggle */}
            {savedOpportunities.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => setShowSaved(!showSaved)}
                  className="btn-tactile btn-ghost px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-2"
                >
                  <span className="text-sm">🔖</span>
                  {showSaved ? "Hide Saved" : `View Saved (${savedOpportunities.length})`}
                </button>
              </div>
            )}

            {/* ── SAVED OPPORTUNITIES ── */}
            {showSaved && (
              <div className="space-y-4 mb-10 fade-in">
                <h3 className="text-xl font-bold tracking-tight text-[var(--accent-emerald)]">
                  Saved
                </h3>

                {savedOpportunities.map((opp, idx) => (
                  <div
                    key={`saved-${idx}`}
                    className="glass-card rounded-xl p-5 relative card-enter"
                    style={{ animationDelay: `${idx * 80}ms`, borderColor: 'var(--border-active)' }}
                  >
                    {/* Left accent bar */}
                    <div className="absolute top-0 left-0 w-[2px] h-full bg-[var(--accent-emerald)] rounded-full" />

                    <div className="flex justify-between items-start pl-4">
                      <div className="space-y-1 min-w-0">
                        <span className="inline-block text-[10px] font-semibold text-[var(--accent-emerald)] uppercase tracking-[0.15em]">
                          {categoryIcons[opp.type] || "📌"} {opp.type}
                        </span>
                        <h3 className="text-base font-bold text-[var(--text-primary)] leading-snug">
                          {opp.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap ml-4 mt-1">
                        ⏱ {opp.deadline}
                      </span>
                    </div>

                    <div className="pl-4 mt-3 space-y-1.5">
                      <p className="text-[11px] text-[var(--text-ghost)]">
                        Time: <span className="text-[var(--text-muted)]">{opp.time_commitment}</span>
                      </p>
                      {opp.description && (
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {opp.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pl-4 pt-4 mt-4 border-t border-[var(--border-subtle)]">
                      <button
                        onClick={() => handleSaveOpp(opp)}
                        className="btn-tactile badge-rejected px-3 py-1.5 rounded-md text-xs font-medium"
                      >
                        Remove
                      </button>
                      <a
                        href={opp.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-sweep text-sm font-semibold text-[var(--accent-emerald)] flex items-center gap-1.5"
                      >
                        Apply <span className="text-xs">→</span>
                      </a>
                    </div>
                  </div>
                ))}

                {/* Email trigger for saved */}
                <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] text-center">
                  <p className="text-xs text-[var(--text-muted)] mb-4">
                    Want these in your inbox?
                  </p>
                  <button
                    onClick={() => handleTriggerEmail(emailToSave)}
                    disabled={!emailToSave || isSendingEmail || savedOpportunities.length === 0}
                    className="btn-tactile btn-primary mx-auto px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-2"
                  >
                    {isSendingEmail ? (
                      <>
                        <span className="loader-dot" />
                        <span className="loader-dot" />
                        <span className="loader-dot" />
                        <span className="ml-1">Sending</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Email Me My List
                      </>
                    )}
                  </button>
                  {!emailToSave && (
                    <p className="text-[10px] text-red-400/70 mt-2">
                      Register your email below first.
                    </p>
                  )}
                </div>

                <div className="border-t border-dashed border-[var(--border-subtle)] my-8" />
              </div>
            )}

            {/* ── AGENT STRATEGY (queries used) ── */}
            {status === "done" && queriesUsed.length > 0 && (
              <div className="glass-card rounded-xl p-5 fade-in" style={{ borderColor: 'rgba(16, 185, 129, 0.15)' }}>
                <h3 className="text-[10px] font-bold text-[var(--accent-emerald)] uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Agent Strategy
                </h3>
                <div className="space-y-1.5">
                  {queriesUsed.map((q, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono text-[var(--text-muted)] p-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)]"
                    >
                      <span className="text-[var(--accent-indigo)] mr-2">$</span>
                      &quot;{q}&quot;
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LOADING STATE ── */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-72 glass-panel rounded-2xl">
                <div className="flex gap-2.5 mb-6">
                  <span className="loader-dot" />
                  <span className="loader-dot" />
                  <span className="loader-dot" />
                </div>
                <p className="font-mono text-sm text-[var(--accent-emerald)] cursor-blink">
                  {status === "searching"
                    ? "Generating search queries"
                    : "Verifying live links"}
                </p>
                <p className="font-mono text-[11px] text-[var(--text-ghost)] mt-2 max-w-xs text-center">
                  {status === "searching"
                    ? "Analyzing your profile and building targeted queries."
                    : "Following redirects, checking deadlines, validating endpoints."}
                </p>
              </div>
            )}

            {/* ── IDLE STATE ── */}
            {status === "idle" && (
              <div className="flex flex-col items-center justify-center h-72 glass-panel rounded-2xl">
                <p className="text-[var(--text-ghost)] text-sm text-center max-w-sm leading-relaxed">
                  Fill in your profile and hit{" "}
                  <span className="text-[var(--accent-emerald)] font-semibold">
                    Find Opportunities
                  </span>{" "}
                  to start.
                </p>
              </div>
            )}

            {/* ── NO RESULTS ── */}
            {status === "done" && opportunities.length === 0 && queriesUsed.length > 0 && (
              <div className="flex flex-col items-center justify-center h-72 glass-panel rounded-2xl border-red-500/15">
                <p className="text-red-400/80 font-semibold text-sm mb-2">
                  No exact matches found.
                </p>
                <p className="text-[var(--text-muted)] text-xs max-w-sm text-center leading-relaxed">
                  We ran a fallback lenient search but still couldn&apos;t find active live links
                  matching your niche profile today. Try adjusting your skills.
                </p>
              </div>
            )}

            {/* ── RESULTS COUNT ── */}
            {status === "done" && opportunities.length > 0 && (
              <p className="text-xs text-[var(--text-ghost)] tracking-wide">
                {opportunities.length} opportunities across{" "}
                {selectedCategories.join(", ")}
              </p>
            )}

            {/* ── OPPORTUNITY CARDS ── */}
            {status === "done" &&
              opportunities.map((opp, idx) => (
                <div
                  key={idx}
                  className="glass-card group rounded-xl p-5 relative card-enter"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  {/* Left accent bar */}
                  <div className="absolute top-0 left-0 w-[2px] h-full rounded-full bg-gradient-to-b from-[var(--accent-indigo)] to-[var(--accent-emerald)]" />

                  {/* Header */}
                  <div className="flex justify-between items-start pl-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold text-[var(--accent-emerald)] uppercase tracking-[0.15em]">
                          {categoryIcons[opp.type] || "📌"} {opp.type}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--accent-emerald)]/60 tracking-wider">
                          ✓ verified
                        </span>
                      </div>
                      <h3 className="kinetic-title text-lg text-[var(--text-primary)] leading-snug">
                        {opp.name}
                      </h3>
                      {opp.organization && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {opp.organization}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap ml-4 mt-1">
                      ⏱ {opp.deadline}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="pl-4 mt-3 space-y-1.5">
                    <p className="text-[11px] text-[var(--text-ghost)]">
                      Time: <span className="text-[var(--text-muted)]">{opp.time_commitment}</span>
                    </p>
                    {opp.description && (
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {opp.description}
                      </p>
                    )}
                  </div>

                  {/* Why it fits — left-border accent, not boxed */}
                  <div className="pl-4 mt-4">
                    <div className="border-l-2 border-[var(--accent-indigo)]/30 pl-4 py-1">
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        <span className="text-[var(--accent-indigo)] font-medium">Why this fits:</span>{" "}
                        {opp.reason}
                      </p>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center justify-between pl-4 pt-4 mt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveOpp(opp)}
                        className={`btn-tactile px-3 py-1.5 rounded-md text-xs font-medium ${
                          actionStatuses[opp.name] === "saved"
                            ? "badge-saved"
                            : "badge-default"
                        }`}
                      >
                        {actionStatuses[opp.name] === "saved" ? "✓ Saved" : "Save"}
                      </button>
                      <button
                        onClick={() =>
                          updateStatus(
                            opp,
                            actionStatuses[opp.name] === "applied" ? "" : "applied"
                          )
                        }
                        className={`btn-tactile px-3 py-1.5 rounded-md text-xs font-medium ${
                          actionStatuses[opp.name] === "applied"
                            ? "badge-applied"
                            : "badge-default"
                        }`}
                      >
                        {actionStatuses[opp.name] === "applied" ? "✓ Applied" : "Applied"}
                      </button>
                      <button
                        onClick={() =>
                          updateStatus(
                            opp,
                            actionStatuses[opp.name] === "rejected" ? "" : "rejected"
                          )
                        }
                        className={`btn-tactile px-3 py-1.5 rounded-md text-xs font-medium ${
                          actionStatuses[opp.name] === "rejected"
                            ? "badge-rejected"
                            : "badge-default"
                        }`}
                      >
                        {actionStatuses[opp.name] === "rejected" ? "✗ Hidden" : "Not Interested"}
                      </button>
                    </div>
                    <a
                      href={opp.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-sweep text-sm font-semibold text-[var(--accent-emerald)] flex items-center gap-1.5"
                    >
                      Apply <span className="text-xs">→</span>
                    </a>
                  </div>
                </div>
              ))}

            {/* ── EMAIL CAPTURE ── */}
            {status === "done" && opportunities.length > 0 && (
              <div
                className="glass-card mt-10 rounded-xl p-6 md:p-8 flex flex-col items-center text-center card-enter"
                style={{ borderColor: 'rgba(99, 102, 241, 0.15)' }}
              >
                <h3 className="text-lg font-semibold tracking-tight mb-1.5">
                  Save these results
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-5 max-w-sm">
                  Enter your email and we&apos;ll remember your saved opportunities for next time.
                </p>
                {savedEmailSuccess ? (
                  <div className="text-[var(--accent-emerald)] font-medium text-sm badge-applied px-5 py-2.5 rounded-lg fade-in">
                    ✓ Email saved — preferences locked in.
                  </div>
                ) : (
                  <div className="flex w-full max-w-md gap-2">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      className="input-field flex-1 rounded-lg px-4 py-2.5 text-sm"
                      value={emailToSave}
                      onChange={(e) => setEmailToSave(e.target.value)}
                    />
                    <button
                      onClick={handleSaveEmail}
                      disabled={!emailToSave}
                      className="btn-tactile btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* ── FOOTER ── */}
        <footer className="mt-24 pb-8 text-center border-t border-[var(--border-subtle)] pt-8">
          <p className="text-[11px] text-[var(--text-ghost)] tracking-wide">
            © 2026 1waygo · Built by Anderson
          </p>
        </footer>
      </div>
    </div>
  );
}
