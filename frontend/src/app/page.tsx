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
    <div className="relative min-h-screen text-[var(--text-primary)] selection:bg-[var(--accent-indigo)]/30 selection:text-white" style={{ background: 'var(--bg-primary)' }}>
      {/* Ambient glow handled by body::after in CSS */}

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-24">

        {/* ── HEADER ── */}
        <header className="mb-16 md:mb-24 flex flex-col items-center md:items-start text-center md:text-left fade-in">
          <h1 className="text-5xl md:text-7xl lg:text-8xl tracking-tighter leading-none mb-4 font-bold">
            <span className="text-[var(--text-ghost)] font-light mr-1">1</span>
            <span className="bg-gradient-to-br from-white via-white to-[var(--accent-emerald)] bg-clip-text text-transparent">waygo</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm md:text-base max-w-xl tracking-wide font-light animate-[fadeIn_1s_ease-out_0.3s_both]">
            Your career, accelerated. AI-curated opportunities perfectly matched to your distinct profile.
          </p>
        </header>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-10 md:gap-16">

          {/* ─── LEFT: PROFILE FORM ─── */}
          <aside className="glass-panel rounded-3xl p-7 md:p-9 h-fit sticky top-12 fade-in">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1.5 h-6 bg-[var(--accent-emerald)] rounded-full"></div>
              <h2 className="text-xl font-medium tracking-tight text-[var(--text-primary)]">
                Your Profile
              </h2>
            </div>

            <div className="space-y-7">
              {/* BRANCH */}
              <div ref={branchRef} className="relative group">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-[0.1em] group-focus-within:text-[var(--accent-emerald)] transition-colors">
                  Branch
                </label>
                <input
                  type="text"
                  placeholder="Search your branch..."
                  className="input-field w-full rounded-xl px-4 py-3 min-h-[44px] text-sm"
                  value={branch || branchSearch}
                  onChange={(e) => {
                    setBranchSearch(e.target.value);
                    setBranch("");
                    setShowBranchDropdown(true);
                  }}
                  onFocus={() => setShowBranchDropdown(true)}
                />
                {showBranchDropdown && filteredBranches.length > 0 && (
                  <div className="dropdown-menu absolute z-20 mt-2 w-full max-h-56 overflow-y-auto rounded-xl shadow-2xl shadow-[var(--bg-primary)]">
                    {filteredBranches.map((b) => (
                      <div
                        key={b}
                        className="dropdown-item px-4 py-2.5 text-sm text-[var(--text-secondary)] cursor-pointer min-h-[44px] flex items-center"
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
              <div className="group">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-[0.1em] group-focus-within:text-[var(--accent-emerald)] transition-colors">
                  Year
                </label>
                <select
                  className="input-field w-full rounded-xl px-4 py-3 min-h-[44px] text-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center] bg-[length:0.65rem_auto]"
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
              <div ref={skillRef} className="relative group">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-[0.1em] group-focus-within:text-[var(--accent-emerald)] transition-colors">
                  Skills &amp; Interests
                </label>

                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedSkills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-sm group/skill hover:border-[var(--accent-indigo)] transition-all"
                      >
                        {s}
                        <button
                          onClick={() => removeSkill(s)}
                          className="ml-1 text-[var(--text-muted)] hover:text-red-400 min-w-[20px] min-h-[20px] flex items-center justify-center rounded transition-colors"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Search skills (e.g. Machine Learning)"
                  className="input-field w-full rounded-xl px-4 py-3 min-h-[44px] text-sm"
                  value={skillSearch}
                  onChange={(e) => {
                    setSkillSearch(e.target.value);
                    setShowSkillDropdown(true);
                  }}
                  onFocus={() => setShowSkillDropdown(true)}
                />

                {showSkillDropdown && filteredSkills.length > 0 && (
                  <div className="dropdown-menu absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-xl shadow-2xl shadow-[var(--bg-primary)]">
                    {filteredSkills.map(({ category, skills }) => (
                      <div key={category}>
                        <div className="px-4 py-2 text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-[0.2em] sticky top-0 bg-[var(--bg-surface)] backdrop-blur-md">
                          {category}
                        </div>
                        {skills.map((s) => (
                          <div
                            key={s}
                            className="dropdown-item px-4 py-2.5 text-sm text-[var(--text-secondary)] cursor-pointer min-h-[44px] flex items-center"
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
              <div className="group">
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-[0.1em] group-focus-within:text-[var(--accent-emerald)] transition-colors">
                  Career Goal
                </label>
                <select
                  className="input-field w-full rounded-xl px-4 py-3 min-h-[44px] text-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center] bg-[length:0.65rem_auto]"
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
              <div className="border-t border-[var(--border-subtle)] my-2" />

              {/* CATEGORY TOGGLES */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-3 uppercase tracking-[0.1em]">
                  Opportunity Types
                </label>
                <div className="flex flex-col gap-2">
                  {CATEGORIES.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleCategory(id)}
                      className={`pill-toggle w-full px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium tracking-wide flex items-center justify-between transition-all ${
                        selectedCategories.includes(id) ? "active border-[var(--accent-emerald)] bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">{icon} {label}</span>
                      <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${selectedCategories.includes(id) ? 'bg-[var(--accent-emerald)]' : 'bg-[var(--border-subtle)]'}`}>
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${selectedCategories.includes(id) ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CONDITIONAL PREFERENCES */}
              {(selectedCategories.includes("Internship") ||
                selectedCategories.includes("Certification")) && (
                <div className="space-y-4 pt-2 fade-in bg-[var(--bg-primary)]/50 p-4 rounded-xl border border-[var(--border-subtle)]">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.1em] flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                    Refine Parameters
                  </p>

                  {selectedCategories.includes("Internship") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Mode</label>
                        <select
                          className="input-field w-full rounded-lg px-3 py-2.5 min-h-[44px] text-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center] bg-[length:0.65rem_auto]"
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
                        <label className="block text-[10px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">City</label>
                        <input
                          type="text"
                          placeholder="e.g. SF"
                          className="input-field w-full rounded-lg px-3 py-2.5 min-h-[44px] text-sm"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedCategories.includes("Certification") && (
                    <div>
                      <label className="block text-[10px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Budget</label>
                      <select
                        className="input-field w-full rounded-lg px-3 py-2.5 min-h-[44px] text-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center] bg-[length:0.65rem_auto]"
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
                className="btn-tactile btn-primary w-full mt-4 min-h-[52px] py-3.5 px-4 rounded-xl text-[15px] tracking-wide font-semibold shadow-lg shadow-[var(--accent-emerald)]/10"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="loader-dot" />
                    <span className="loader-dot" />
                    <span className="loader-dot" />
                    <span className="ml-1 opacity-80">Synthesizing Results...</span>
                  </span>
                ) : (
                  "Find Opportunities"
                )}
              </button>
            </div>
          </aside>

          {/* ─── RIGHT: RESULTS ─── */}
          <main className="space-y-6 min-w-0">

            {/* Saved Toggle */}
            {savedOpportunities.length > 0 && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowSaved(!showSaved)}
                  className="btn-tactile glass-card px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold tracking-wide flex items-center gap-2 hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <span className="text-sm">🔖</span>
                  {showSaved ? "Hide Saved" : `View Saved (${savedOpportunities.length})`}
                </button>
              </div>
            )}

            {/* ── SAVED OPPORTUNITIES ── */}
            {showSaved && (
              <div className="space-y-5 mb-12 fade-in">
                <h3 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-3">
                  <span className="text-[var(--accent-emerald)]">Your Vault</span>
                </h3>

                {savedOpportunities.length === 0 ? (
                  <div className="glass-panel rounded-2xl p-8 text-center text-[var(--text-muted)] border-dashed">
                    No saved opportunities yet.
                  </div>
                ) : (
                  savedOpportunities.map((opp, idx) => (
                    <div
                      key={`saved-${idx}`}
                      className="glass-card rounded-2xl p-6 relative card-enter"
                      style={{ animationDelay: `${idx * 80}ms`, borderColor: 'var(--border-active)' }}
                    >
                      <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--accent-emerald)] rounded-l-2xl" />

                      <div className="flex justify-between items-start pl-4">
                        <div className="space-y-1.5 min-w-0">
                          <span className="inline-block text-[10px] font-bold text-[var(--accent-emerald)] uppercase tracking-[0.15em] bg-[var(--accent-emerald)]/10 px-2 py-0.5 rounded">
                            {categoryIcons[opp.type] || "📌"} {opp.type}
                          </span>
                          <h3 className="text-lg font-bold text-[var(--text-primary)] leading-snug">
                            {opp.name}
                          </h3>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-primary)] px-2 py-1 rounded-md ml-4 mt-1 border border-[var(--border-subtle)]">
                          ⏱ {opp.deadline}
                        </span>
                      </div>

                      <div className="pl-4 mt-4 space-y-2">
                        <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          <span className="text-[var(--text-primary)] font-medium">{opp.time_commitment}</span>
                        </p>
                        {opp.description && (
                          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                            {opp.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pl-4 pt-5 mt-5 border-t border-[var(--border-subtle)]/50">
                        <button
                          onClick={() => handleSaveOpp(opp)}
                          className="btn-tactile text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 px-4 py-2 min-h-[44px] rounded-lg text-xs font-semibold transition-colors"
                        >
                          Remove
                        </button>
                        <a
                          href={opp.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-sweep text-sm font-bold text-[var(--accent-emerald)] flex items-center gap-1.5 min-h-[44px] px-2"
                        >
                          Apply Now <span className="text-lg leading-none">→</span>
                        </a>
                      </div>
                    </div>
                  ))
                )}

                {/* Email trigger for saved */}
                <div className="mt-8 p-6 glass-panel rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Inbox Delivery</p>
                    <p className="text-xs text-[var(--text-muted)]">Get this curated list sent to your email.</p>
                  </div>
                  <div className="flex flex-col items-center sm:items-end">
                    <button
                      onClick={() => handleTriggerEmail(emailToSave)}
                      disabled={!emailToSave || isSendingEmail || savedOpportunities.length === 0}
                      className="btn-tactile btn-primary px-6 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold tracking-wide flex items-center gap-2"
                    >
                      {isSendingEmail ? (
                        <>
                          <span className="loader-dot" />
                          <span className="loader-dot" />
                          <span className="loader-dot" />
                          <span className="ml-1">Dispatching</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Send to Email
                        </>
                      )}
                    </button>
                    {!emailToSave && (
                      <p className="text-[10px] text-[var(--accent-emerald)]/70 mt-2 font-mono">
                        Requires email registration below
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-dashed border-[var(--border-subtle)] my-10" />
              </div>
            )}

            {/* ── AGENT STRATEGY (queries used) ── */}
            {status === "done" && queriesUsed.length > 0 && (
              <div className="glass-panel rounded-2xl p-6 fade-in mb-6 bg-[var(--bg-primary)]/80">
                <h3 className="text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--accent-indigo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 9l3 3-3 3m5 0h3M4 15V9a2 2 0 012-2h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
                  </svg>
                  Agent Execution Log
                </h3>
                <div className="space-y-2">
                  {queriesUsed.map((q, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono text-[var(--text-secondary)] p-3 rounded-lg border border-[var(--border-subtle)] bg-[#050810]"
                    >
                      <span className="text-[var(--accent-indigo)] mr-2 select-none">❯</span>
                      {q}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LOADING STATE ── */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-80 glass-panel rounded-3xl border border-[var(--accent-emerald)]/20 shadow-[0_0_40px_rgba(16,185,129,0.05)]">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-[var(--accent-emerald)] rounded-full blur-xl opacity-20 animate-pulse"></div>
                  <div className="flex gap-3 relative">
                    <span className="loader-dot w-2 h-2" />
                    <span className="loader-dot w-2 h-2" />
                    <span className="loader-dot w-2 h-2" />
                  </div>
                </div>
                <h3 className="font-mono text-base text-[var(--text-primary)] font-medium mb-2 flex items-center gap-2">
                  <span className="text-[var(--accent-emerald)]">System:</span>
                  <span className="cursor-blink">
                    {status === "searching" ? "Synthesizing parameters..." : "Validating active endpoints..."}
                  </span>
                </h3>
                <p className="font-mono text-[11px] text-[var(--text-secondary)] mt-1 max-w-sm text-center leading-relaxed">
                  {status === "searching"
                    ? "Executing high-precision semantic search against targeted databases."
                    : "Pinging URLs, verifying deadlines, mapping real-time availability."}
                </p>
              </div>
            )}

            {/* ── IDLE STATE ── */}
            {status === "idle" && (
              <div className="flex flex-col items-center justify-center h-80 glass-panel rounded-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoOTksIDEwMiwgMjQxLCAwLjE1KSIvPjwvc3ZnPg==')] opacity-50 group-hover:opacity-100 transition-opacity duration-1000"></div>
                <div className="relative z-10 flex flex-col items-center">
                  <svg className="w-12 h-12 text-[var(--border-subtle)] mb-6 group-hover:text-[var(--accent-emerald)]/30 transition-colors duration-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <p className="text-[var(--text-secondary)] text-base text-center max-w-sm leading-relaxed font-light">
                    Configure your parameters and initialize <span className="text-[var(--text-primary)] font-medium">Find Opportunities</span> to deploy the agent.
                  </p>
                </div>
              </div>
            )}

            {/* ── NO RESULTS ── */}
            {status === "done" && opportunities.length === 0 && queriesUsed.length > 0 && (
              <div className="flex flex-col items-center justify-center h-80 glass-panel rounded-3xl border border-red-500/20 bg-red-500/5">
                <svg className="w-10 h-10 text-red-400/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-400 font-semibold text-base mb-2">
                  Zero exact matches verified.
                </p>
                <p className="text-[var(--text-secondary)] text-sm max-w-md text-center leading-relaxed">
                  Fallback search executed but active endpoints within your highly specific niche were not found. Broaden your skills or adjust parameters.
                </p>
              </div>
            )}

            {/* ── RESULTS COUNT ── */}
            {status === "done" && opportunities.length > 0 && (
              <div className="flex items-center gap-3 py-2 fade-in">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse"></div>
                <p className="text-xs text-[var(--text-secondary)] tracking-wider uppercase font-semibold">
                  <span className="text-[var(--text-primary)]">{opportunities.length}</span> Curated Matches <span className="text-[var(--text-muted)] mx-1">|</span> {selectedCategories.join(" · ")}
                </p>
              </div>
            )}

            {/* ── OPPORTUNITY CARDS ── */}
            <div className="space-y-6">
              {status === "done" &&
                opportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className="glass-card group rounded-2xl p-6 md:p-7 relative card-enter"
                    style={{ animationDelay: `${idx * 120}ms` }}
                  >
                    {/* Refined Left accent bar */}
                    <div className="absolute top-0 left-0 w-[4px] h-full rounded-l-2xl bg-gradient-to-b from-[var(--accent-indigo)] to-[var(--accent-emerald)] opacity-60 group-hover:opacity-100 transition-opacity" />

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start pl-3 md:pl-5 gap-4">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[10px] font-bold text-[var(--accent-emerald)] uppercase tracking-[0.2em] bg-[var(--accent-emerald)]/10 px-2.5 py-1 rounded-md">
                            {categoryIcons[opp.type] || "📌"} {opp.type}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--accent-emerald)]/60 tracking-wider flex items-center gap-1 border border-[var(--accent-emerald)]/20 px-2 py-0.5 rounded-md">
                            <span className="w-1 h-1 rounded-full bg-[var(--accent-emerald)]"></span> Verified
                          </span>
                        </div>
                        <h3 className="kinetic-title text-xl md:text-2xl text-[var(--text-primary)] leading-tight mt-1">
                          {opp.name}
                        </h3>
                        {opp.organization && (
                          <p className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                            {opp.organization}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 bg-[var(--bg-primary)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-right">
                        <span className="block text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Deadline</span>
                        <span className="text-xs font-mono text-[var(--text-primary)] whitespace-nowrap">
                          {opp.deadline}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="pl-3 md:pl-5 mt-5 space-y-3">
                      <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2 bg-[var(--bg-primary)]/40 inline-flex px-3 py-1.5 rounded-md border border-[var(--border-subtle)]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Commitment: <span className="text-[var(--text-primary)] font-medium">{opp.time_commitment}</span>
                      </p>
                      {opp.description && (
                        <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-3xl">
                          {opp.description}
                        </p>
                      )}
                    </div>

                    {/* Why it fits — AI Insight Panel */}
                    <div className="pl-3 md:pl-5 mt-6">
                      <div className="bg-[var(--bg-primary)]/60 border border-[var(--border-subtle)] rounded-xl p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[var(--accent-indigo)]/50 to-transparent"></div>
                        <div className="flex gap-3">
                          <svg className="w-5 h-5 text-[var(--accent-indigo)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <div>
                            <span className="text-[10px] font-bold text-[var(--text-ghost)] uppercase tracking-[0.2em] block mb-1">AI Insight</span>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                              {opp.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between pl-3 md:pl-5 pt-5 mt-6 border-t border-[var(--border-subtle)]/50 gap-4">
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleSaveOpp(opp)}
                          className={`btn-tactile px-4 py-2 min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider flex-1 sm:flex-none transition-colors ${
                            actionStatuses[opp.name] === "saved"
                              ? "badge-saved"
                              : "badge-default bg-[var(--bg-primary)]/50"
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
                          className={`btn-tactile px-4 py-2 min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider flex-1 sm:flex-none transition-colors ${
                            actionStatuses[opp.name] === "applied"
                              ? "badge-applied"
                              : "badge-default bg-[var(--bg-primary)]/50"
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
                          className={`btn-tactile px-4 py-2 min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider flex-1 sm:flex-none transition-colors ${
                            actionStatuses[opp.name] === "rejected"
                              ? "badge-rejected"
                              : "badge-default bg-[var(--bg-primary)]/50"
                          }`}
                        >
                          {actionStatuses[opp.name] === "rejected" ? "✗ Hidden" : "Hide"}
                        </button>
                      </div>
                      <a
                        href={opp.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-sweep text-[15px] font-bold text-[var(--accent-emerald)] flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg hover:bg-[var(--accent-emerald)]/10 transition-colors w-full sm:w-auto"
                      >
                        Launch App <span className="text-lg leading-none">→</span>
                      </a>
                    </div>
                  </div>
                ))}
            </div>

            {/* ── EMAIL CAPTURE ── */}
            {status === "done" && opportunities.length > 0 && (
              <div
                className="glass-panel mt-12 rounded-3xl p-8 md:p-12 flex flex-col items-center text-center card-enter bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-primary)] relative overflow-hidden"
                style={{ borderColor: 'rgba(99, 102, 241, 0.2)' }}
              >
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--accent-indigo)]/10 rounded-full blur-3xl pointer-events-none"></div>
                <h3 className="text-2xl font-bold tracking-tight mb-2 text-[var(--text-primary)]">
                  Secure Your Stack
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md font-light leading-relaxed">
                  Register your email to sync your saved opportunities and preferences across sessions.
                </p>
                {savedEmailSuccess ? (
                  <div className="text-[var(--accent-emerald)] font-medium text-sm badge-applied px-6 py-3 rounded-xl fade-in flex items-center gap-2 border border-[var(--accent-emerald)]/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    Identity verified. Preferences synchronized.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row w-full max-w-lg gap-3">
                    <input
                      type="email"
                      placeholder="hello@example.com"
                      className="input-field flex-1 rounded-xl px-5 py-3 min-h-[52px] text-base"
                      value={emailToSave}
                      onChange={(e) => setEmailToSave(e.target.value)}
                    />
                    <button
                      onClick={handleSaveEmail}
                      disabled={!emailToSave}
                      className="btn-tactile btn-primary px-8 py-3 min-h-[52px] rounded-xl text-sm font-bold tracking-wide w-full sm:w-auto"
                    >
                      Initialize Sync
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* ── FOOTER ── */}
        <footer className="mt-32 pb-10 text-center border-t border-[var(--border-subtle)] pt-10 fade-in">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-ghost)]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-ghost)]"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-ghost)]"></span>
          </div>
          <p className="text-[11px] text-[var(--text-ghost)] tracking-[0.2em] uppercase font-semibold">
            © 2026 1waygo <span className="mx-2 font-normal">/</span> Engineered by Anderson
          </p>
        </footer>
      </div>
    </div>
  );
}
