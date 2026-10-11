"use client";

import { useEffect, useMemo, useState } from "react";
import topicBank from "../daily_curiosity_topics.json";
import factBank from "../daily_curiosity_facts.json";

type Topic = (typeof topicBank.topics)[number];
type Fact = (typeof factBank.facts)[number] & { image?: { src: string; alt: string; credit: string; sourceUrl: string; license: string } };
type FactProgress = { seenFactIds: string[]; attempts: number; correct: number; currentStreak: number; bestStreak: number; recentCorrectPositions: number[]; currentFactId: string | null; selectedAnswer: number | null; roundQuestionNumber: number; roundCorrect: number; roundAttempts: number; roundComplete: boolean };
type IconName = "spark" | "shuffle" | "bookmark" | "search" | "arrow" | "sun" | "clock" | "copy" | "check" | "chevron" | "close" | "menu" | "all" | "heart";
const FACTS_PER_ROUND = 10;

const iconPaths: Record<IconName, React.ReactNode> = {
  spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/><path d="m5 16 .7 1.8L7.5 18.5l-1.8.7L5 21l-.7-1.8-1.8-.7 1.8-.7L5 16Z"/></>,
  shuffle: <><path d="m18 14 4 4-4 4"/><path d="M2 18h2.5a6 6 0 0 0 4.8-2.4l5.4-7.2A6 6 0 0 1 19.5 6H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h2.5a6 6 0 0 1 4.8 2.4l.8 1.1M14 14.5l.7 1.1a6 6 0 0 0 4.8 2.4H22"/></>,
  bookmark: <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-4-6 4V4.8Z"/>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
  arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  chevron: <path d="m7 10 5 5 5-5"/>,
  close: <path d="m18 6-12 12M6 6l12 12"/>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  all: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  heart: <path d="M20.8 8.8c0 4.2-8.8 10-8.8 10S3.2 13 3.2 8.8a4.3 4.3 0 0 1 8.8-1.5 4.3 4.3 0 0 1 8.8 1.5Z"/>,
};

function Icon({ name, size = 18, fill = "none" }: { name: IconName; size?: number; fill?: string }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

const categoryIcons: Record<string, string> = {
  psychology: "◉", philosophy: "◌", money_business: "↗", ai_future: "⌘", books_ideas: "▤", relationships: "♡", entertainment: "▷", society_culture: "◎", mysteries_history: "✳", hypotheticals: "✧", personal_reflections: "☼", science_nature: "❋",
};

function daySeed(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function chooseUnseen<T extends { id: string }>(pool: T[], currentId: string, seenIds: string[]) {
  if (!pool.length) return { item: undefined, seenIds };
  const poolIds = new Set(pool.map((item) => item.id));
  const seen = new Set(seenIds.filter((id) => poolIds.has(id)));
  seen.add(currentId);
  let choices = pool.filter((item) => !seen.has(item.id));
  let nextSeen = seenIds;
  if (!choices.length) {
    nextSeen = seenIds.filter((id) => !poolIds.has(id));
    choices = pool.filter((item) => item.id !== currentId);
    if (!choices.length) choices = pool;
  }
  const item = choices[Math.floor(Math.random() * choices.length)];
  return { item, seenIds: [...new Set([...nextSeen, currentId, item.id])] };
}

function createFactOptionOrder(fact: Fact, recentPositions: number[]) {
  const count = fact.options.length;
  const recent = recentPositions.slice(-Math.min(2, count - 1));
  const availablePositions = Array.from({ length: count }, (_, index) => index).filter((position) => !recent.includes(position));
  const correctPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
  const distractors = fact.options.map((_, index) => index).filter((index) => index !== fact.answerIndex);
  for (let index = distractors.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [distractors[index], distractors[swapIndex]] = [distractors[swapIndex], distractors[index]];
  }
  const order: number[] = [];
  let distractorIndex = 0;
  for (let position = 0; position < count; position += 1) {
    order.push(position === correctPosition ? fact.answerIndex : distractors[distractorIndex++]);
  }
  return order;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [currentTopic, setCurrentTopic] = useState<Topic>(topicBank.topics[daySeed() % topicBank.topics.length]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [showAngles, setShowAngles] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [showFacts, setShowFacts] = useState(false);
  const [currentFact, setCurrentFact] = useState<Fact>(factBank.facts[daySeed() % factBank.facts.length]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [topicHistory, setTopicHistory] = useState<string[]>([]);
  const [topicHistoryLoaded, setTopicHistoryLoaded] = useState(false);
  const [factProgress, setFactProgress] = useState<FactProgress>({ seenFactIds: [], attempts: 0, correct: 0, currentStreak: 0, bestStreak: 0, recentCorrectPositions: [], currentFactId: null, selectedAnswer: null, roundQuestionNumber: 1, roundCorrect: 0, roundAttempts: 0, roundComplete: false });
  const [factProgressLoaded, setFactProgressLoaded] = useState(false);
  const [orderedFactOptions, setOrderedFactOptions] = useState(() => Array.from({ length: currentFact.options.length }, (_, index) => index));

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("curio-saved") || "[]");
      const validIds = new Set(topicBank.topics.map((topic) => topic.id));
      setSavedIds(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string" && validIds.has(id)) : []);
    } catch { setSavedIds([]); }
    setSavedLoaded(true);
  }, []);

  useEffect(() => {
    if (savedLoaded) localStorage.setItem("curio-saved", JSON.stringify(savedIds));
  }, [savedIds, savedLoaded]);

  useEffect(() => {
    const validTopicIds = new Set(topicBank.topics.map((topic) => topic.id));
    const validFactIds = new Set(factBank.facts.map((fact) => fact.id));
    let storedTopics: string[] = [];
    let storedFacts: FactProgress = { seenFactIds: [], attempts: 0, correct: 0, currentStreak: 0, bestStreak: 0, recentCorrectPositions: [], currentFactId: null, selectedAnswer: null, roundQuestionNumber: 1, roundCorrect: 0, roundAttempts: 0, roundComplete: false };
    try {
      const parsedTopics: unknown = JSON.parse(localStorage.getItem("curio-topic-history") || "[]");
      if (Array.isArray(parsedTopics)) storedTopics = parsedTopics.filter((id): id is string => typeof id === "string" && validTopicIds.has(id));
    } catch { storedTopics = []; }
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem("curio-fact-progress") || "{}");
      if (parsed && typeof parsed === "object") {
        const value = parsed as Partial<FactProgress>;
        storedFacts = {
          seenFactIds: Array.isArray(value.seenFactIds) ? value.seenFactIds.filter((id): id is string => typeof id === "string" && validFactIds.has(id)) : [],
          attempts: Number.isFinite(value.attempts) ? Math.max(0, Number(value.attempts)) : 0,
          correct: Number.isFinite(value.correct) ? Math.max(0, Number(value.correct)) : 0,
          currentStreak: Number.isFinite(value.currentStreak) ? Math.max(0, Number(value.currentStreak)) : 0,
          bestStreak: Number.isFinite(value.bestStreak) ? Math.max(0, Number(value.bestStreak)) : 0,
          recentCorrectPositions: Array.isArray(value.recentCorrectPositions) ? value.recentCorrectPositions.filter((position): position is number => Number.isInteger(position) && position >= 0 && position < 3).slice(-2) : [],
          currentFactId: typeof value.currentFactId === "string" && validFactIds.has(value.currentFactId) ? value.currentFactId : null,
          selectedAnswer: Number.isInteger(value.selectedAnswer) && Number(value.selectedAnswer) >= 0 ? Number(value.selectedAnswer) : null,
          roundQuestionNumber: Number.isInteger(value.roundQuestionNumber) ? Math.min(FACTS_PER_ROUND, Math.max(1, Number(value.roundQuestionNumber))) : 1,
          roundCorrect: Number.isFinite(value.roundCorrect) ? Math.max(0, Number(value.roundCorrect)) : 0,
          roundAttempts: Number.isFinite(value.roundAttempts) ? Math.max(0, Number(value.roundAttempts)) : 0,
          roundComplete: value.roundComplete === true,
        };
      }
    } catch { storedFacts = { seenFactIds: [], attempts: 0, correct: 0, currentStreak: 0, bestStreak: 0, recentCorrectPositions: [], currentFactId: null, selectedAnswer: null, roundQuestionNumber: 1, roundCorrect: 0, roundAttempts: 0, roundComplete: false }; }

    if (storedTopics.includes(currentTopic.id)) {
      const next = chooseUnseen(topicBank.topics, currentTopic.id, storedTopics);
      if (next.item) {
        setCurrentTopic(next.item);
        storedTopics = next.seenIds;
      }
    } else {
      storedTopics = [...storedTopics, currentTopic.id];
    }
    const savedCurrentFact = factBank.facts.find((fact) => fact.id === storedFacts.currentFactId) as Fact | undefined;
    const activeFact = savedCurrentFact ?? currentFact;
    if (savedCurrentFact) {
      setCurrentFact(savedCurrentFact);
      const selected = storedFacts.selectedAnswer;
      setSelectedAnswer(selected !== null && selected < savedCurrentFact.options.length ? selected : null);
      if (!storedFacts.seenFactIds.includes(savedCurrentFact.id)) storedFacts.seenFactIds = [...storedFacts.seenFactIds, savedCurrentFact.id];
      storedFacts.currentFactId = savedCurrentFact.id;
      const order = createFactOptionOrder(savedCurrentFact, storedFacts.recentCorrectPositions);
      setOrderedFactOptions(order);
      storedFacts.recentCorrectPositions = [...storedFacts.recentCorrectPositions, order.indexOf(savedCurrentFact.answerIndex)].slice(-2);
    } else if (storedFacts.seenFactIds.includes(activeFact.id)) {
      const next = chooseUnseen(factBank.facts as Fact[], activeFact.id, storedFacts.seenFactIds);
      if (next.item) {
        setCurrentFact(next.item);
        storedFacts.seenFactIds = next.seenIds;
        storedFacts.currentFactId = next.item.id;
        storedFacts.selectedAnswer = null;
        const order = createFactOptionOrder(next.item, storedFacts.recentCorrectPositions);
        setOrderedFactOptions(order);
        storedFacts.recentCorrectPositions = [...storedFacts.recentCorrectPositions, order.indexOf(next.item.answerIndex)].slice(-2);
      }
    } else {
      storedFacts.seenFactIds = [...storedFacts.seenFactIds, activeFact.id];
      storedFacts.currentFactId = activeFact.id;
      const order = createFactOptionOrder(activeFact, storedFacts.recentCorrectPositions);
      setOrderedFactOptions(order);
      storedFacts.recentCorrectPositions = [...storedFacts.recentCorrectPositions, order.indexOf(activeFact.answerIndex)].slice(-2);
    }
    setTopicHistory(storedTopics);
    setFactProgress(storedFacts);
    setTopicHistoryLoaded(true);
    setFactProgressLoaded(true);
    // This is one-time browser hydration; the initial daily items are intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!topicHistoryLoaded) return;
    try { localStorage.setItem("curio-topic-history", JSON.stringify(topicHistory)); } catch { /* Storage may be disabled. */ }
  }, [topicHistory, topicHistoryLoaded]);

  useEffect(() => {
    if (!factProgressLoaded) return;
    try { localStorage.setItem("curio-fact-progress", JSON.stringify(factProgress)); } catch { /* Storage may be disabled. */ }
  }, [factProgress, factProgressLoaded]);

  const activeCategoryName = topicBank.categories.find((category) => category.id === activeCategory)?.name;
  const savedTopics = useMemo(() => topicBank.topics.filter((topic) => savedIds.includes(topic.id)), [savedIds]);
  const filteredTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    return topicBank.topics.filter((topic) => {
      const category = topicBank.categories.find((item) => item.id === topic.categoryId);
      return (activeCategory === "all" || topic.categoryId === activeCategory) && (!query || topic.question.toLowerCase().includes(query) || category?.name.toLowerCase().includes(query));
    });
  }, [activeCategory, search]);

  function chooseRandom() {
    const pool = topicBank.topics.filter((topic) => activeCategory === "all" || topic.categoryId === activeCategory);
    const selection = chooseUnseen(pool, currentTopic.id, topicHistory);
    if (selection.item) {
      setCurrentTopic(selection.item);
      setTopicHistory(selection.seenIds);
      setShowAngles(false);
      setShowSaved(false);
      setShowSearch(false);
      setToast("A fresh thought, just for you");
      window.setTimeout(() => setToast(""), 2200);
    }
  }

  function chooseCategory(id: string) {
    setShowFacts(false);
    setActiveCategory(id);
    setMobileNav(false);
    setSearch("");
    setShowSearch(false);
    setShowSaved(false);
    setShowAngles(false);
    if (id !== "all") {
      const pool = topicBank.topics.filter((topic) => topic.categoryId === id);
      const selection = chooseUnseen(pool, currentTopic.id, topicHistory);
      if (selection.item) {
        setCurrentTopic(selection.item);
        setTopicHistory(selection.seenIds);
      }
    } else if (!topicBank.topics.some((topic) => topic.id === currentTopic.id)) {
      const selection = chooseUnseen(topicBank.topics, currentTopic.id, topicHistory);
      if (selection.item) {
        setCurrentTopic(selection.item);
        setTopicHistory(selection.seenIds);
      }
    }
  }

  function openFacts() {
    setShowFacts(true);
    setShowSaved(false);
    setShowSearch(false);
    setShowAngles(false);
    setMobileNav(false);
  }

  function chooseAnotherFact() {
    if (factProgress.roundQuestionNumber >= FACTS_PER_ROUND) {
      setFactProgress((progress) => ({ ...progress, roundComplete: true }));
      return;
    }
    const selection = chooseUnseen(factBank.facts as Fact[], currentFact.id, factProgress.seenFactIds);
    if (selection.item) {
      const order = createFactOptionOrder(selection.item, factProgress.recentCorrectPositions);
      setCurrentFact(selection.item);
      setOrderedFactOptions(order);
      setFactProgress((progress) => ({ ...progress, seenFactIds: selection.seenIds, recentCorrectPositions: [...progress.recentCorrectPositions, order.indexOf(selection.item!.answerIndex)].slice(-2), currentFactId: selection.item!.id, selectedAnswer: null, roundQuestionNumber: progress.roundQuestionNumber + 1 }));
    }
    setSelectedAnswer(null);
  }

  function answerFact(originalIndex: number) {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(originalIndex);
    setFactProgress((progress) => {
      const correct = originalIndex === currentFact.answerIndex;
      const currentStreak = correct ? progress.currentStreak + 1 : 0;
      return { ...progress, attempts: progress.attempts + 1, correct: progress.correct + Number(correct), currentStreak, bestStreak: Math.max(progress.bestStreak, currentStreak), selectedAnswer: originalIndex, roundAttempts: progress.roundAttempts + 1, roundCorrect: progress.roundCorrect + Number(correct) };
    });
  }

  function resetFactProgress() {
    setFactProgress((progress) => ({ ...progress, attempts: 0, correct: 0, currentStreak: 0, bestStreak: 0 }));
  }

  function startAnotherRound() {
    const selection = chooseUnseen(factBank.facts as Fact[], currentFact.id, factProgress.seenFactIds);
    if (!selection.item) return;
    const order = createFactOptionOrder(selection.item, factProgress.recentCorrectPositions);
    setCurrentFact(selection.item);
    setOrderedFactOptions(order);
    setSelectedAnswer(null);
    setFactProgress((progress) => ({ ...progress, seenFactIds: selection.seenIds, recentCorrectPositions: [...progress.recentCorrectPositions, order.indexOf(selection.item!.answerIndex)].slice(-2), currentFactId: selection.item!.id, selectedAnswer: null, roundQuestionNumber: 1, roundCorrect: 0, roundAttempts: 0, roundComplete: false }));
  }

  function toggleSaved(topic: Topic) {
    setSavedIds((ids) => ids.includes(topic.id) ? ids.filter((id) => id !== topic.id) : [...ids, topic.id]);
  }

  async function copyTopic() {
    const text = `${currentTopic.question}${showAngles ? `\n\n${currentTopic.angles.join("\n")}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setToast("Copy isn’t available in this browser"); window.setTimeout(() => setToast(""), 2200); }
  }

  const today = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const displayTopic = showSaved ? savedTopics[0] : currentTopic;
  const currentCategory = topicBank.categories.find((category) => category.id === displayTopic?.categoryId);

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a href="#home" className="brand" onClick={() => { setShowFacts(false); setShowSaved(false); setShowSearch(false); }}>
          <span className="brand-mark"><Icon name="spark" size={21} /></span><span>curio<span className="brand-period">.</span></span>
        </a>
        <div className="nav-label">YOUR SPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <button className={`nav-item ${!showFacts && !showSaved && activeCategory === "all" ? "nav-active" : ""}`} onClick={() => chooseCategory("all")}><Icon name="all" size={17} /><span>Explore</span><span className="nav-count">{topicBank.topics.length}</span></button>
          <button className={`nav-item ${showFacts ? "nav-active" : ""}`} onClick={openFacts}><Icon name="spark" size={17} /><span>Fact Sparks</span><span className="nav-count">{factBank.facts.length}</span></button>
          <button className={`nav-item ${showSaved ? "nav-active" : ""}`} onClick={() => { setShowFacts(false); setShowSaved(true); setShowSearch(false); setMobileNav(false); }}><Icon name="bookmark" size={17} /><span>Saved topics</span><span className="nav-count">{savedIds.length || "—"}</span></button>
        </nav>
        <div className="category-heading"><span className="nav-label">CATEGORIES</span><span className="category-total">12</span></div>
        <nav className="category-nav" aria-label="Topic categories">
          {topicBank.categories.map((category) => <button key={category.id} className={`nav-item category-item ${!showSaved && activeCategory === category.id ? "nav-active" : ""}`} onClick={() => chooseCategory(category.id)}><span className="category-glyph">{categoryIcons[category.id]}</span><span className="category-name">{category.name}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="note-icon"><Icon name="sun" size={16} /></span><p>Small questions.<br /><em>Big inner worlds.</em></p></div>
          <div className="sidebar-credit">A space to follow your curiosity <span>✳</span></div>
        </div>
      </aside>

      {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}

      <section className="workspace" id="home">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Icon name="menu" size={20} /></button>
          <div className="breadcrumb"><span>YOUR SPACE</span><span className="crumb-divider">/</span><strong>{showFacts ? "FACT SPARKS" : showSaved ? "SAVED TOPICS" : showSearch ? "SEARCH" : activeCategory === "all" ? "EXPLORE" : activeCategoryName?.toUpperCase()}</strong></div>
          <div className="topbar-actions">
            <span className="date-label"><Icon name="sun" size={15} /> {today}</span>
            <button className={`icon-button top-search ${showSearch ? "icon-button-selected" : ""}`} aria-label="Search topics" onClick={() => { setShowFacts(false); setShowSearch((value) => !value); setShowSaved(false); setSearch(""); }}><Icon name="search" size={19} /></button>
            <button className="avatar" aria-label="Curio profile">c<span>.</span></button>
          </div>
        </header>

        <div className="content-area">
          <div className="intro-row">
            <div className="intro-copy"><div className="eyebrow"><span className="eyebrow-dot" /> {showFacts ? "A QUICK SPARK OF WONDER" : "A MOMENT FOR YOUR MIND"}</div><h1>{showFacts ? <>Tiny facts.<br /><span>Big wonder.</span></> : showSaved ? <>Your little<br /><span>collection.</span></> : showSearch ? <>Find a thought<br /><span>to follow.</span></> : <>Stay a little<br /><span>curious.</span></>}</h1><p>{showFacts ? "Take a guess, uncover something surprising, then follow the question wherever it leads." : showSaved ? "The questions you’ve kept close." : showSearch ? `Search ${topicBank.topics.length} questions and find one that stays with you.` : "One good question can take you somewhere unexpected."}</p></div>
            <div className="intro-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-orbit orbit-three"/><div className="art-center"><Icon name="spark" size={32} /></div><span className="art-dot dot-one"/><span className="art-dot dot-two"/><span className="art-dot dot-three"/></div>
          </div>

          {showSearch && <div className="search-wrap"><Icon name="search" size={19} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try “identity”, “future”, or “happiness”…" aria-label="Search topic questions" /><span>{filteredTopics.length} {filteredTopics.length === 1 ? "question" : "questions"}</span>{search && <button className="clear-search" aria-label="Clear search" onClick={() => setSearch("")}><Icon name="close" size={16} /></button>}</div>}

          {showFacts && <section className="facts-section" aria-labelledby="facts-title">
            <div className="section-heading"><div><span className="section-kicker"><span className="live-dot" /> FACT SPARK</span><h2 id="facts-title">A little mystery to solve</h2></div><div className="fact-score-wrap"><span className="duration"><Icon name="clock" size={15} /> 1 min</span><span className="fact-score">{factProgress.attempts ? <>{factProgress.correct}/{factProgress.attempts} right <span>·</span> streak {factProgress.currentStreak} <span>·</span> best {factProgress.bestStreak}</> : "No score yet"}</span>{factProgress.attempts > 0 && <button className="fact-reset-button" onClick={resetFactProgress}>Reset score</button>}</div></div>
            <article className="fact-card">
              {factProgress.roundComplete ? <div className="fact-round-complete"><span className="section-kicker"><span className="live-dot" /> ROUND COMPLETE</span><h3>Ten little facts, one curious mind.</h3><p>You answered {factProgress.roundAttempts} of {FACTS_PER_ROUND} and got {factProgress.roundCorrect} right. Your next round will bring a fresh set.</p><button className="generate-button" onClick={startAnotherRound}><Icon name="shuffle" size={16}/> Start another round <span className="button-arrow"><Icon name="arrow" size={15}/></span></button></div> : <>
                <div className="fact-card-top"><span className="category-pill"><span className="pill-dot"/>{currentFact.category}</span><span className="fact-counter">Question {factProgress.roundQuestionNumber} of {FACTS_PER_ROUND}</span></div>
                <div className="fact-round-track" role="progressbar" aria-label="Round progress" aria-valuemin={0} aria-valuemax={FACTS_PER_ROUND} aria-valuenow={factProgress.roundQuestionNumber}><span style={{ width: `${(factProgress.roundQuestionNumber / FACTS_PER_ROUND) * 100}%` }} /></div>
                <h3 className="fact-question">{currentFact.question}</h3>
                <div className="fact-options" role="group" aria-label="Choose your answer">{orderedFactOptions.map((originalIndex, displayIndex) => {
                  const option = currentFact.options[originalIndex];
                  const answered = selectedAnswer !== null;
                  const isCorrect = originalIndex === currentFact.answerIndex;
                  const isSelected = selectedAnswer === originalIndex;
                  return <button key={option} className={`fact-option ${answered && isCorrect ? "fact-option-correct" : ""} ${answered && isSelected && !isCorrect ? "fact-option-wrong" : ""}`} disabled={answered || !factProgressLoaded} onClick={() => answerFact(originalIndex)}><span className="fact-option-letter">{String.fromCharCode(65 + displayIndex)}</span><span>{option}</span>{answered && isCorrect && <Icon name="check" size={17}/>}</button>;
                })}</div>
                {selectedAnswer !== null && <div className={`fact-reveal ${currentFact.image ? "fact-reveal-with-image" : ""}`} aria-live="polite"><div className="fact-reveal-copy"><div className="fact-result"><Icon name={selectedAnswer === currentFact.answerIndex ? "check" : "spark"} size={16}/>{selectedAnswer === currentFact.answerIndex ? "You got it" : "Here is the surprising part"}</div><p className="fact-headline">{currentFact.fact}</p><p className="fact-explanation">{currentFact.explanation}</p><a className="fact-source" href={currentFact.source.url} target="_blank" rel="noreferrer">Source: {currentFact.source.title}<Icon name="arrow" size={14}/></a><div className="fact-wonder"><span className="fact-wonder-label"><Icon name="spark" size={14}/> KEEP WONDERING</span><p>{currentFact.wonderQuestion}</p></div></div>{currentFact.image && <figure className="fact-image"><img src={currentFact.image.src} alt={currentFact.image.alt} loading="lazy"/><figcaption><a href={currentFact.image.sourceUrl} target="_blank" rel="noreferrer">{currentFact.image.credit}</a><span> · </span><a href={currentFact.image.license} target="_blank" rel="noreferrer">Image source & license</a></figcaption></figure>}</div>}
                <div className="fact-footer"><span>{selectedAnswer === null ? "Trust your first guess." : "One small fact can lead somewhere unexpected."}</span><button className="generate-button" disabled={!factProgressLoaded} onClick={chooseAnotherFact}><Icon name="shuffle" size={16}/>{selectedAnswer === null ? (factProgress.roundQuestionNumber === FACTS_PER_ROUND ? "Skip & finish" : "Skip this one") : (factProgress.roundQuestionNumber === FACTS_PER_ROUND ? "See round results" : "Another fact")}<span className="button-arrow"><Icon name="arrow" size={15}/></span></button></div>
              </>}
            </article>
            <div className="fact-bridge"><div className="lower-note-icon"><Icon name="heart" size={18}/></div><p><strong>Want to go deeper?</strong><span>Explore a question and make the idea your own.</span></p><button onClick={() => chooseCategory("all")}>Explore prompts <Icon name="arrow" size={15}/></button></div>
          </section>}

          {!showFacts && !showSearch && !showSaved && <section className="daily-section" aria-labelledby="daily-title">
            <div className="section-heading"><div><span className="section-kicker"><span className="live-dot" /> TODAY’S PROMPT</span><h2 id="daily-title">A thought to take with you</h2></div><span className="duration"><Icon name="clock" size={15} /> 5–15 min</span></div>
            <article className="prompt-card">
              <div className="card-wash" aria-hidden="true"><span/><span/><span/></div>
              <div className="prompt-card-top"><span className="category-pill"><span className="pill-dot"/>{currentCategory?.name ?? "Pick a prompt"}</span><button className={`save-button ${savedIds.includes(displayTopic.id) ? "is-saved" : ""}`} aria-label={savedIds.includes(displayTopic.id) ? "Remove saved topic" : "Save topic"} onClick={() => toggleSaved(displayTopic)}><Icon name="bookmark" size={18} fill={savedIds.includes(displayTopic.id) ? "currentColor" : "none"} /></button></div>
              <div className="prompt-main"><span className="quote-mark">“</span><h3>{displayTopic.question}</h3></div>
              {showAngles && <div className="angles-panel"><div className="angles-title"><Icon name="spark" size={15}/> A few paths you could follow</div><div className="angles-list">{displayTopic.angles.map((angle, index) => <div className="angle-row" key={angle}><span>0{index + 1}</span><p>{angle}</p></div>)}</div></div>}
              <div className="prompt-card-bottom"><button className={`angles-button ${showAngles ? "angles-open" : ""}`} onClick={() => setShowAngles((value) => !value)}><Icon name="spark" size={15}/>{showAngles ? "Hide follow-up questions" : "Need a starting point?"}<Icon name="chevron" size={14}/></button><div className="prompt-actions"><button className={`text-action ${copied ? "action-success" : ""}`} onClick={copyTopic}><Icon name={copied ? "check" : "copy"} size={15}/>{copied ? "Copied" : "Copy"}</button><span className="action-separator"/><button className="text-action" onClick={chooseRandom}><Icon name="shuffle" size={15}/>Another one</button></div></div>
            </article>
            <div className="generate-row"><div className="generate-hint"><span className="hint-spark">✳</span><span>{activeCategory === "all" ? `${topicBank.topics.length} little doors to open` : `${topicBank.categories.find(c => c.id === activeCategory)?.count ?? 0} prompts in this collection`}</span></div><button className="generate-button" onClick={chooseRandom}><Icon name="shuffle" size={17}/> Surprise me <span className="button-arrow"><Icon name="arrow" size={16}/></span></button></div>
          </section>}

          {showSaved && <section className="library-section"><div className="library-heading"><div><span className="section-kicker"><Icon name="bookmark" size={14}/> YOUR LIBRARY</span><h2>Kept for later</h2></div><span className="library-count">{savedTopics.length} {savedTopics.length === 1 ? "topic" : "topics"}</span></div>{savedTopics.length ? <div className="topic-list">{savedTopics.map((topic) => {const category=topicBank.categories.find(c=>c.id===topic.categoryId); return <button className={`topic-row ${currentTopic.id===topic.id?"topic-row-active":""}`} key={topic.id} onClick={()=>{setCurrentTopic(topic);setShowSaved(false);setShowAngles(false);}}><span className="topic-row-glyph">{categoryIcons[topic.categoryId]}</span><span className="topic-row-copy"><span>{category?.name}</span><strong>{topic.question}</strong></span><Icon name="arrow" size={17}/></button>;})}</div>:<div className="empty-state"><span className="empty-icon"><Icon name="bookmark" size={21}/></span><h3>A home for good questions.</h3><p>Tap the bookmark on any prompt and it’ll find its way here.</p><button onClick={()=>chooseCategory("all")}>Explore prompts <Icon name="arrow" size={15}/></button></div>}</section>}

          {showSearch && <section className="results-section"><div className="results-heading"><div><span className="section-kicker">THE CURIOSITY LIBRARY</span><h2>{search ? `Thoughts about “${search}”` : "Every good question starts somewhere."}</h2></div></div>{filteredTopics.length ? <div className="topic-list">{filteredTopics.slice(0, 20).map((topic) => {const category=topicBank.categories.find(c=>c.id===topic.categoryId); return <button className="topic-row" key={topic.id} onClick={()=>{setCurrentTopic(topic);setShowSearch(false);setShowAngles(false);}}><span className="topic-row-glyph">{categoryIcons[topic.categoryId]}</span><span className="topic-row-copy"><span>{category?.name}</span><strong>{topic.question}</strong></span><Icon name="arrow" size={17}/></button>;})}</div>:<div className="empty-state"><span className="empty-icon"><Icon name="search" size={21}/></span><h3>No thoughts found (yet).</h3><p>Try a different word, or wander through a category.</p><button onClick={()=>setSearch("")}>Clear search <Icon name="arrow" size={15}/></button></div>}</section>}

          {!showFacts && !showSearch && !showSaved && <section className="lower-note"><div className="lower-note-icon"><Icon name="heart" size={19}/></div><p><strong>There’s no right answer.</strong><span>Just your answer, and the fun of finding it.</span></p><span className="lower-note-flower">✳</span></section>}
          <footer className="page-footer"><span>MADE FOR THE WONDERFULLY CURIOUS</span><span>ONE QUESTION AT A TIME <i>✳</i></span></footer>
        </div>
      </section>
      {toast && <div className="toast" role="status"><Icon name="spark" size={15}/>{toast}</div>}
    </main>
  );
}
