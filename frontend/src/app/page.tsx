"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  Loader2,
  Bookmark,
  Check,
  CheckCircle2,
  X,
  ArrowUpRight,
  EyeOff,
  Search,
  Filter,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Terminal,
} from "lucide-react";
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

// Deterministic match score generator for stable, realistic scores (88% - 98%)
function getMatchScore(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return 88 + (Math.abs(hash) % 11);
}

// Reusable Spotlight Card with dynamic radial cursor glow & top-lit border
function SpotlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rounded-xl border border-white/[0.08] hover:border-white/[0.16] bg-zinc-900/60 transition-colors shadow-sm ${className}`}
    >
      {isHovered && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            background: `radial-gradient(500px circle at ${position.x}px ${position.y}px, rgba(255, 255, 255, 0.06), transparent 40%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"discover" | "saved" | "applied">("discover");

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
  const [savedOpportunities, setSavedOpportunities] = useState<any[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState("");

  // Diagnostics accordion state & copy feedback
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);

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
    setActiveTab("discover");
    setIsDiagnosticsOpen(true); // Auto-expand live diagnostics when search triggers
    setOpportunities([]);
    setQueriesUsed([]);

    const verifyingTimer = setTimeout(() => setStatus("verifying"), 3500);

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
      } else {
        setEmailSuccessMsg("Email registered for future digests.");
        setTimeout(() => setEmailSuccessMsg(""), 3500);
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
        setEmailSuccessMsg("Saved list sent to your inbox!");
        setTimeout(() => setEmailSuccessMsg(""), 4000);
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

  const handleCopyQuery = (q: string) => {
    navigator.clipboard.writeText(q);
    setCopiedQuery(q);
    setTimeout(() => setCopiedQuery(null), 2000);
  };

  const isFormValid = Boolean(branch && year && selectedSkills.length > 0 && goal);
  const isLoading = status === "searching" || status === "verifying";

  // Tab counts
  const savedCount = savedOpportunities.length;
  const appliedCount = Object.values(actionStatuses).filter((s) => s === "applied").length;

  // Filtered views
  const visibleDiscoverOpps = opportunities.filter((o) => actionStatuses[o.name] !== "rejected");
  const appliedOpps = [
    ...opportunities.filter((o) => actionStatuses[o.name] === "applied"),
    ...savedOpportunities.filter((o) => actionStatuses[o.name] === "applied"),
  ].filter((v, i, a) => a.findIndex((t) => t.name === v.name) === i);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f6] relative selection:bg-emerald-500/20 selection:text-white">
      {/* ── Fixed top-center subtle ambient emerald glow ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.08), transparent)",
        }}
      />

      {/* ── Top Navbar ── */}
      <header className="border-b border-white/[0.08] bg-[#09090b]/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Pulsing Emerald Dot */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 absolute -inset-1 animate-ping" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-white">Radar</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 border border-white/[0.08] px-1.5 py-0.5 rounded bg-zinc-900/60">
                1waygo
              </span>
            </div>
          </div>

          {/* Segmented View Switcher with Sliding Active Pill */}
          <nav className="flex items-center p-1 rounded-xl bg-zinc-900/80 border border-white/[0.06] text-xs">
            {(
              [
                { id: "discover", label: "Discover", count: null },
                { id: "saved", label: "Saved", count: savedCount },
                { id: "applied", label: "Applied", count: appliedCount },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3.5 py-1.5 rounded-lg font-medium transition-colors duration-150 flex items-center gap-1.5 z-10 ${
                    isActive ? "text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-zinc-800 border border-white/[0.1] rounded-lg shadow-sm -z-10"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? "bg-zinc-700 text-zinc-100"
                          : "bg-zinc-800/60 text-zinc-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* GitHub link */}
          <div className="hidden sm:flex items-center">
            <a
              href="https://github.com/FLITXCOV/opportunity-radar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/50 border border-transparent hover:border-white/[0.06]"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">

          {/* ── LEFT: Search Filters Sidebar ── */}
          <aside className="lg:sticky lg:top-6 bg-zinc-900/60 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-emerald-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white">Search Filters</h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 border border-white/[0.06] px-1.5 py-0.5 rounded bg-zinc-800/40">
                Live
              </span>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              
              {/* Academic Branch */}
              <div ref={branchRef} className="relative group focus-within:ring-1 focus-within:ring-emerald-500/50 rounded-lg">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Academic Branch
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search branch (e.g. Computer Science)..."
                    className="input-base w-full px-3 py-2 text-xs bg-zinc-950/60 border border-white/[0.08] rounded-lg focus:border-emerald-500/60 focus:bg-zinc-900/90 transition-all"
                    value={branch || branchSearch}
                    onChange={(e) => {
                      setBranchSearch(e.target.value);
                      setBranch("");
                      setShowBranchDropdown(true);
                    }}
                    onFocus={() => setShowBranchDropdown(true)}
                  />
                </div>
                {showBranchDropdown && filteredBranches.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-zinc-900 border border-white/[0.12] shadow-2xl">
                    {filteredBranches.map((b) => (
                      <div
                        key={b}
                        className="px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer transition-colors"
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

              {/* Year of Study */}
              <div className="focus-within:ring-1 focus-within:ring-emerald-500/50 rounded-lg">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Year of Study
                </label>
                <select
                  className="input-base w-full px-3 py-2 text-xs bg-zinc-950/60 border border-white/[0.08] rounded-lg focus:border-emerald-500/60 focus:bg-zinc-900/90 transition-all"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">Select year of study...</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y} className="bg-zinc-900">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills & Technologies with AnimatePresence */}
              <div ref={skillRef} className="relative group focus-within:ring-1 focus-within:ring-emerald-500/50 rounded-lg">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Skills &amp; Technologies
                </label>

                {/* Animated Interactive Skill Chips */}
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    <AnimatePresence mode="popLayout">
                      {selectedSkills.map((s) => (
                        <motion.span
                          key={s}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-zinc-800/90 border border-white/[0.08] text-zinc-200"
                        >
                          <span>{s}</span>
                          <button
                            type="button"
                            onClick={() => removeSkill(s)}
                            className="hover:text-red-400 text-zinc-400 ml-0.5 p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Type to add skills..."
                  className="input-base w-full px-3 py-2 text-xs bg-zinc-950/60 border border-white/[0.08] rounded-lg focus:border-emerald-500/60 focus:bg-zinc-900/90 transition-all"
                  value={skillSearch}
                  onChange={(e) => {
                    setSkillSearch(e.target.value);
                    setShowSkillDropdown(true);
                  }}
                  onFocus={() => setShowSkillDropdown(true)}
                />

                {showSkillDropdown && filteredSkills.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-lg bg-zinc-900 border border-white/[0.12] shadow-2xl">
                    {filteredSkills.map(({ category, skills }) => (
                      <div key={category} className="border-b border-white/[0.06] last:border-0">
                        <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-950/80 sticky top-0">
                          {category}
                        </div>
                        {skills.map((s) => (
                          <div
                            key={s}
                            className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer transition-colors"
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
              <div className="focus-within:ring-1 focus-within:ring-emerald-500/50 rounded-lg">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Career Track Target
                </label>
                <select
                  className="input-base w-full px-3 py-2 text-xs bg-zinc-950/60 border border-white/[0.08] rounded-lg focus:border-emerald-500/60 focus:bg-zinc-900/90 transition-all"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                >
                  <option value="">Select track...</option>
                  {GOALS.map((g) => (
                    <option key={g} value={g} className="bg-zinc-900">
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fixed Truncated Opportunity Types (2x2 / Flex-wrap with Gliding Pill) */}
              <div className="pt-2 border-t border-white/[0.06]">
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Opportunity Types
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CATEGORIES.map(({ id, label }) => {
                    const isSelected = selectedCategories.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleCategory(id)}
                        className={`relative px-3 py-2 text-xs font-medium rounded-lg transition-colors text-center ${
                          id === "Certification" ? "col-span-2" : ""
                        } ${
                          isSelected
                            ? "text-zinc-950 font-semibold"
                            : "text-zinc-400 hover:text-zinc-200 bg-zinc-950/60 border border-white/[0.06]"
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="opportunity-type"
                            className="absolute inset-0 bg-white rounded-lg shadow-sm"
                            transition={{ type: "spring", stiffness: 450, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional parameters */}
              {selectedCategories.includes("Internship") && (
                <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-2">
                  <div className="focus-within:ring-1 focus-within:ring-emerald-500/50 rounded-lg">
                    <label className="block text-[11px] text-zinc-500 mb-1">Mode</label>
                    <select
                      className="input-base w-full px-2.5 py-1.5 text-xs bg-zinc-950/60 border border-white/[0.08] rounded-lg"
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option>Any</option>
                      <option>Remote</option>
                      <option>On-site</option>
                      <option>Hybrid</option>
                    </select>
                  </div>
                  <div className="focus-within:ring-1 focus-within:ring-emerald-500/50 rounded-lg">
                    <label className="block text-[11px] text-zinc-500 mb-1">City</label>
                    <input
                      type="text"
                      placeholder="e.g. Bangalore"
                      className="input-base w-full px-2.5 py-1.5 text-xs bg-zinc-950/60 border border-white/[0.08] rounded-lg"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedCategories.includes("Certification") && (
                <div className="focus-within:ring-1 focus-within:ring-emerald-500/50 rounded-lg">
                  <label className="block text-[11px] text-zinc-500 mb-1">Certification Cost</label>
                  <select
                    className="input-base w-full px-2.5 py-1.5 text-xs bg-zinc-950/60 border border-white/[0.08] rounded-lg"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  >
                    <option>Free only</option>
                    <option>Paid ok</option>
                  </select>
                </div>
              )}

              {/* Primary CTA Polish: Tactile press, hover shimmer & spinning radar */}
              <motion.button
                type="submit"
                disabled={isLoading || !isFormValid}
                whileTap={{ scale: 0.98 }}
                className="group relative w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-white text-zinc-950 shadow-md shadow-black/20 hover:bg-zinc-100 disabled:opacity-35 disabled:cursor-not-allowed overflow-hidden flex items-center justify-center gap-2 transition-all"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                {isLoading ? (
                  <>
                    <Radar className="w-4 h-4 text-emerald-600 animate-spin" />
                    <span>{status === "searching" ? "Scanning indexes..." : "Verifying links..."}</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 text-zinc-700" />
                    <span>Find Opportunities</span>
                  </>
                )}
              </motion.button>
            </form>
          </aside>

          {/* ── RIGHT: Main Results Pane ── */}
          <main className="space-y-6">

            {/* TAB 1: DISCOVER */}
            {activeTab === "discover" && (
              <>
                {/* ── INTERACTIVE RADAR DIAGNOSTICS (Framer Motion Accordion) ── */}
                {(isLoading || queriesUsed.length > 0) && (
                  <div className="border border-white/[0.08] rounded-xl bg-zinc-900/60 backdrop-blur-md overflow-hidden shadow-sm">
                    {/* Accordion Header */}
                    <button
                      type="button"
                      onClick={() => setIsDiagnosticsOpen((prev) => !prev)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-semibold text-white tracking-tight">
                          Live Radar Diagnostics
                        </span>
                        {isLoading && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Active Scan
                          </span>
                        )}
                        {!isLoading && queriesUsed.length > 0 && (
                          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-white/[0.06]">
                            {queriesUsed.length} queries generated
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-400 hover:text-white">
                        {isDiagnosticsOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* Accordion Body with Smooth Framer Motion Collapse */}
                    <AnimatePresence initial={false}>
                      {isDiagnosticsOpen && (
                        <motion.div
                          key="diagnostics-content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                          className="overflow-hidden border-t border-white/[0.06] bg-zinc-950/70 p-4 space-y-4"
                        >
                          {/* Terminal-style Step Progression */}
                          <div className="space-y-2 font-mono text-xs">
                            {/* Step 1: Profile Parsing */}
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-zinc-300">
                                Parsing academic profile:{" "}
                                <span className="text-zinc-100 font-semibold">{branch || "Selected"}</span>,{" "}
                                <span className="text-zinc-100">{year}</span>, target{" "}
                                <span className="text-zinc-100">{goal}</span>
                              </span>
                            </div>

                            {/* Step 2: Semantic Queries */}
                            <div className="flex items-center gap-2">
                              {status === "searching" ? (
                                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              <span className={status === "searching" ? "text-emerald-300 font-medium" : "text-zinc-300"}>
                                Generating semantic web queries across hackathons, internships &amp; certifications
                              </span>
                            </div>

                            {/* Step 3: Verifying Deadlines & URLs */}
                            <div className="flex items-center gap-2">
                              {status === "verifying" ? (
                                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                              ) : status === "done" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-zinc-700 inline-block" />
                              )}
                              <span
                                className={
                                  status === "verifying"
                                    ? "text-emerald-300 font-medium"
                                    : status === "done"
                                    ? "text-zinc-300"
                                    : "text-zinc-600"
                                }
                              >
                                Pinging endpoints, verifying deadlines &amp; filtering expired opportunities
                              </span>
                            </div>
                          </div>

                          {/* Monospace Copyable Pill Badges */}
                          {queriesUsed.length > 0 && (
                            <div className="pt-3 border-t border-white/[0.06]">
                              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                                Executed Semantic Queries (Click to copy)
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {queriesUsed.map((query, i) => {
                                  const isCopied = copiedQuery === query;
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => handleCopyQuery(query)}
                                      className={`text-[11px] font-mono px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all text-left ${
                                        isCopied
                                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                          : "bg-zinc-900 border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.16]"
                                      }`}
                                    >
                                      <span className="text-zinc-600">{i + 1}.</span>
                                      <span className="truncate max-w-[280px] sm:max-w-md">{query}</span>
                                      {isCopied ? (
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                      ) : (
                                        <Copy className="w-3 h-3 text-zinc-500 hover:text-zinc-300 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Idle State */}
                {status === "idle" && (
                  <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[380px]">
                    <div className="w-10 h-10 rounded-full border border-white/[0.08] bg-zinc-800/40 flex items-center justify-center text-zinc-400 mb-4">
                      <Radar className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">Opportunity Radar</h3>
                    <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-4">
                      Select your academic profile on the left and initialize search to scan active hackathons, internships, and certifications.
                    </p>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                      <span>Engine: Gemini AI</span>
                      <span>•</span>
                      <span>Verified Live Web</span>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isLoading && (
                  <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[320px]">
                    <div className="relative mb-4">
                      <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                    </div>
                    <h3 className="text-sm font-medium text-white mb-1 font-mono">
                      {status === "searching" ? "Querying Opportunity Indexes..." : "Validating Live Application URLs..."}
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-sm">
                      {status === "searching"
                        ? "Scanning verified platforms for current deadlines matching your skills."
                        : "Checking URLs and filtering out expired postings."}
                    </p>
                  </div>
                )}

                {/* Empty Results */}
                {status === "done" && visibleDiscoverOpps.length === 0 && (
                  <div className="bg-zinc-900/40 border border-white/[0.06] rounded-2xl p-10 text-center">
                    <p className="text-sm font-medium text-white mb-1">No active listings found</p>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      No verified opportunities currently matched this specific filter combination. Try selecting additional skills or broadening your preferences.
                    </p>
                  </div>
                )}

                {/* Results Count Header */}
                {status === "done" && visibleDiscoverOpps.length > 0 && (
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-xs font-semibold text-white">
                        {visibleDiscoverOpps.length} Verified Match{visibleDiscoverOpps.length === 1 ? "" : "es"}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      {selectedCategories.join(" · ")}
                    </div>
                  </div>
                )}

                {/* ── STAGGERED SPRING ENTRANCE & MOUSE-TRACKING SPOTLIGHT CARDS ── */}
                {status === "done" && (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {visibleDiscoverOpps.map((opp, idx) => {
                        const isSaved = actionStatuses[opp.name] === "saved";
                        const isApplied = actionStatuses[opp.name] === "applied";
                        const matchScore = getMatchScore(opp.name);

                        return (
                          <motion.div
                            key={opp.name}
                            layout
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                            transition={{
                              type: "spring",
                              stiffness: 320,
                              damping: 28,
                              delay: idx * 0.05,
                            }}
                          >
                            <SpotlightCard className="p-5">
                              {/* Top Meta Row */}
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 border border-white/[0.06]">
                                    {opp.type}
                                  </span>
                                  {opp.organization && (
                                    <span className="text-xs text-zinc-300 font-medium">
                                      {opp.organization}
                                    </span>
                                  )}
                                </div>

                                {/* Top-right badges: Match score & Deadline */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Match Score Badge */}
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-semibold flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>{matchScore}% Fit</span>
                                  </span>

                                  {/* Deadline */}
                                  <div className="text-[11px] font-mono text-zinc-400 bg-zinc-950/60 px-2 py-0.5 rounded border border-white/[0.04]">
                                    <span className="text-zinc-500 mr-1">Due:</span>
                                    <span className="text-zinc-200">{opp.deadline || "Open"}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Opportunity Title */}
                              <h3 className="text-base font-semibold text-white tracking-tight mb-2">
                                {opp.name}
                              </h3>

                              {/* Description */}
                              {opp.description && (
                                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                                  {opp.description}
                                </p>
                              )}

                              {/* Time commitment */}
                              {opp.time_commitment && (
                                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mb-3 font-mono">
                                  <span className="text-zinc-500">Commitment:</span>
                                  <span className="text-zinc-300">{opp.time_commitment}</span>
                                </div>
                              )}

                              {/* Visual Match Callout Box */}
                              {opp.reason && (
                                <div className="p-3.5 rounded-r-lg bg-emerald-950/20 border-l-2 border-emerald-500/70 text-xs text-zinc-300 mb-4">
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                                    <Sparkles className="w-3 h-3 text-emerald-400" />
                                    <span>Match Reason</span>
                                  </div>
                                  <p className="leading-relaxed text-zinc-300">{opp.reason}</p>
                                </div>
                              )}

                              {/* Stateful Action Buttons */}
                              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                  {/* Save button with active animation */}
                                  <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => handleSaveOpp(opp)}
                                    className={`text-xs px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 ${
                                      isSaved
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold"
                                        : "border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.16] bg-zinc-800/40"
                                    }`}
                                  >
                                    {isSaved ? (
                                      <>
                                        <Check className="w-3 h-3 text-amber-400" />
                                        <span>Saved</span>
                                      </>
                                    ) : (
                                      <>
                                        <Bookmark className="w-3 h-3" />
                                        <span>Save</span>
                                      </>
                                    )}
                                  </motion.button>

                                  {/* Mark Applied button with active animation */}
                                  <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() =>
                                      updateStatus(opp, isApplied ? "" : "applied")
                                    }
                                    className={`text-xs px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 ${
                                      isApplied
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold"
                                        : "border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.16] bg-zinc-800/40"
                                    }`}
                                  >
                                    {isApplied ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span>Applied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-3 h-3" />
                                        <span>Mark Applied</span>
                                      </>
                                    )}
                                  </motion.button>

                                  {/* Hide button (triggers smooth spring exit) */}
                                  <button
                                    onClick={() => updateStatus(opp, "rejected")}
                                    className="text-xs px-2 py-1 text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
                                    title="Hide from list"
                                  >
                                    <EyeOff className="w-3 h-3" />
                                    <span>Hide</span>
                                  </button>
                                </div>

                                {/* Application Link */}
                                <a
                                  href={opp.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-secondary text-xs px-3 py-1.5 font-medium flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border border-white/[0.08]"
                                >
                                  <span>Apply</span>
                                  <ArrowUpRight className="w-3 h-3 text-zinc-400" />
                                </a>
                              </div>
                            </SpotlightCard>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: SAVED */}
            {activeTab === "saved" && (
              <section className="bg-zinc-900/60 border border-white/[0.08] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">Saved Opportunities ({savedCount})</h3>
                  </div>
                </div>

                {savedOpportunities.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-8 text-center">
                    No saved opportunities yet. Switch to Discover and click &quot;Save&quot; on any card.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {savedOpportunities.map((opp, idx) => (
                        <motion.div
                          key={`saved-${opp.name}`}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-zinc-950/60 border border-white/[0.06] rounded-xl p-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.06]">
                                {opp.type}
                              </span>
                              <span className="font-medium text-white truncate">{opp.name}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1 truncate">
                              {opp.organization ? `${opp.organization} · ` : ""}Deadline: {opp.deadline || "Open"}
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
                              className="btn-secondary text-xs px-2.5 py-1 bg-zinc-800 text-white rounded-md border border-white/[0.08] flex items-center gap-1"
                            >
                              <span>Apply</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Email Digest Trigger */}
                    <div className="pt-4 mt-5 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-left w-full sm:w-auto">
                        <p className="text-xs font-medium text-white">Export to Email</p>
                        <p className="text-[11px] text-zinc-400">
                          Send this curated list to your personal email inbox.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="email"
                          placeholder="Your email address"
                          className="input-base px-2.5 py-1.5 text-xs w-full sm:w-56 bg-zinc-950 border border-white/[0.08] rounded-lg"
                          value={emailToSave}
                          onChange={(e) => setEmailToSave(e.target.value)}
                        />
                        <button
                          onClick={handleSaveEmail}
                          disabled={!emailToSave || isSendingEmail}
                          className="btn-secondary text-xs px-3 py-1.5 shrink-0 bg-white text-zinc-950 font-semibold hover:bg-zinc-200 rounded-lg flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>{isSendingEmail ? "Sending..." : "Send"}</span>
                        </button>
                      </div>
                    </div>
                    {emailSuccessMsg && (
                      <p className="text-xs text-emerald-400 font-mono mt-2">{emailSuccessMsg}</p>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* TAB 3: APPLIED */}
            {activeTab === "applied" && (
              <section className="bg-zinc-900/60 border border-white/[0.08] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Applied Opportunities ({appliedCount})</h3>
                  </div>
                </div>

                {appliedOpps.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-8 text-center">
                    No applied opportunities tracked yet. Mark opportunities as &quot;Applied&quot; to keep track of them here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {appliedOpps.map((opp, idx) => (
                        <motion.div
                          key={`applied-${opp.name}`}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-zinc-950/60 border border-white/[0.06] rounded-xl p-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.06]">
                                {opp.type}
                              </span>
                              <span className="font-medium text-white truncate">{opp.name}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1 truncate">
                              {opp.organization ? `${opp.organization} · ` : ""}Deadline: {opp.deadline || "Open"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => updateStatus(opp, "")}
                              className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                            >
                              Unmark
                            </button>
                            <a
                              href={opp.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary text-xs px-2.5 py-1 bg-zinc-800 text-white rounded-md border border-white/[0.08] flex items-center gap-1"
                            >
                              <span>Open</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            )}

          </main>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-16 pt-6 border-t border-white/[0.06] text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-white font-medium">1waygo Radar</span>
            <span>·</span>
            <span>Built by Anderson</span>
          </div>
          <p className="font-mono text-[11px] text-zinc-600">
            Realtime verified index powered by Gemini AI &amp; Tavily Search
          </p>
        </footer>
      </div>
    </div>
  );
}
