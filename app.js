(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* private browsing fallback */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (_) { /* no-op */ }
    }
  };

  const progressKey = "ictPulse7Progress";
  const preferencesKey = "ictPulse7Preferences";
  const stopNames = ["diagnostic", "concepts", "decision", "create"];
  let completedStops = storage.get(progressKey, []);
  if (!Array.isArray(completedStops)) completedStops = [];

  function markComplete(stop) {
    if (!stopNames.includes(stop) || completedStops.includes(stop)) return;
    completedStops.push(stop);
    storage.set(progressKey, completedStops);
    updateLessonProgress();
  }

  function updateLessonProgress() {
    const percent = Math.round((completedStops.length / stopNames.length) * 100);
    const bar = $("#lessonProgressBar");
    const text = $("#lessonProgressText");
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${percent}%`;
    $$('[data-stop]').forEach((section) => {
      section.classList.toggle("completed", completedStops.includes(section.dataset.stop));
    });
  }

  function showResult(element, score, total, passed, messages) {
    if (!element) return;
    const message = passed ? messages.pass : messages.review;
    element.className = `quiz-result show ${passed ? "success" : "review"}`;
    element.innerHTML = `<strong>${score}/${total}</strong> · ${message}`;
  }

  function scoreRadioQuiz(form, resultElement, stopToComplete, messages) {
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const fieldsets = $$('fieldset[data-answer]', form);
      let score = 0;
      let answered = 0;

      fieldsets.forEach((fieldset) => {
        const correctValue = fieldset.dataset.answer;
        const checked = $('input[type="radio"]:checked', fieldset);
        const labels = $$('label', fieldset);
        labels.forEach((label) => label.classList.remove("correct", "incorrect"));

        if (checked) {
          answered += 1;
          if (checked.value === correctValue) score += 1;
        }

        labels.forEach((label) => {
          const input = $('input[type="radio"]', label);
          if (input && input.value === correctValue) label.classList.add("correct");
          if (input && input.checked && input.value !== correctValue) label.classList.add("incorrect");
        });

        const feedback = $('.case-feedback', fieldset);
        if (feedback) {
          feedback.textContent = feedback.dataset.feedback || "";
          feedback.classList.add("show");
        }
      });

      if (answered < fieldsets.length) {
        resultElement.className = "quiz-result show review";
        resultElement.textContent = `Please answer all ${fieldsets.length} questions before checking.`;
        return;
      }

      const passing = Number(form.dataset.passing || Math.ceil(fieldsets.length * .8));
      const passed = score >= passing;
      showResult(resultElement, score, fieldsets.length, passed, messages);
      if (stopToComplete === "diagnostic" || passed) markComplete(stopToComplete);
      resultElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function setupClassificationQuiz() {
    const form = $("#classificationQuiz");
    const result = $("#classificationResult");
    if (!form || !result) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const rows = $$('label[data-answer]', form);
      let score = 0;
      let answered = 0;
      rows.forEach((row) => {
        const select = $('select', row);
        row.classList.remove("correct", "incorrect");
        if (select.value) answered += 1;
        const correct = select.value === row.dataset.answer;
        if (correct) score += 1;
        if (select.value) row.classList.add(correct ? "correct" : "incorrect");
      });
      if (answered < rows.length) {
        result.className = "quiz-result show review";
        result.textContent = "Choose a classification for every statement first.";
        return;
      }
      const passed = score >= 3;
      showResult(result, score, rows.length, passed, {
        pass: "Strong signal. You can distinguish a developing technology pattern from a concern that needs attention.",
        review: "Revisit the clue words: a trend describes what is changing; an issue describes what needs attention. Then try again."
      });
      if (passed) markComplete("concepts");
    });
  }

  function setupTaskChecklist() {
    const checks = $$('[data-task-check]');
    const status = $("#taskCheckStatus");
    if (!checks.length || !status) return;
    const update = () => {
      const count = checks.filter((check) => check.checked).length;
      status.textContent = count === checks.length
        ? "5 of 5 checked · Your brief is ready for peer review."
        : `${count} of ${checks.length} checked`;
      if (count === checks.length) markComplete("create");
    };
    checks.forEach((check) => check.addEventListener("change", update));
  }

  function setupFormatChoices() {
    const output = $("#formatInstructions");
    const choices = $$('.format-option');
    if (!output || !choices.length) return;
    const instructions = {
      slides: "<strong>3-slide visual brief:</strong> Slide 1 introduces the trend; Slide 2 connects the benefit and issue using evidence; Slide 3 recommends an action and lists sources.",
      doc: "<strong>One-page analysis:</strong> Use the headings Trend, Evidence, Benefit, Issue, Affected Groups, Recommendation, and References. Aim for 350–500 words.",
      video: "<strong>2-minute explainer:</strong> Introduce the trend, show or describe one example, explain the benefit and issue, recommend an action, and end with spoken or on-screen sources. Submit a transcript.",
      poster: "<strong>Print-ready poster:</strong> Use one clear title, a trend–benefit–issue relationship, two evidence notes, one action statement, and readable source credits. Paper and digital versions use the same rubric."
    };
    choices.forEach((button) => button.addEventListener("click", () => {
      choices.forEach((choice) => choice.classList.remove("active"));
      button.classList.add("active");
      output.innerHTML = instructions[button.dataset.format];
    }));
  }

  function setupPromptLab() {
    const output = $("#promptText");
    const tabs = $$('[data-prompt]');
    const copyButton = $("#copyPrompt");
    if (!output || !tabs.length) return;
    const prompts = {
      teacher: "Create six short Grade 7 scenarios about current ICT trends and issues in a Philippine school or community context. Include AI, IoT, cloud computing, connectivity, privacy, misinformation, access, and e-waste. For each scenario: (1) identify the trend or issue, (2) explain the classification in two sentences, and (3) suggest one current, reliable source to verify the claim. Do not invent statistics or citations. Use clear, age-appropriate language.",
      learner: "Help me analyze [ICT TREND] and its connection to [ICT ISSUE]. Ask me one question at a time so I—not you—identify: a local example, one benefit, one risk, people affected, evidence I should verify, and a responsible action. Do not write my final output. If you provide a factual claim, label it CHECK THIS and suggest an authoritative source type. Use Grade 7 language.",
      feedback: "Review the draft ICT Impact Brief below using these four criteria: (1) accuracy and explanation, (2) analysis and recommendation, (3) evidence and verification, and (4) communication and responsible AI use. Give one Glow, one Question, and one specific Next Step. Do not rewrite the draft. Flag claims that need a source and explain why. Draft: [PASTE A DRAFT WITH ALL PERSONAL INFORMATION REMOVED]"
    };
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      tabs.forEach((item) => item.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      output.textContent = prompts[tab.dataset.prompt];
    }));
    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(output.textContent);
          copyButton.textContent = "Copied ✓";
        } catch (_) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(output);
          selection.removeAllRanges();
          selection.addRange(range);
          copyButton.textContent = "Selected—copy now";
        }
        setTimeout(() => { copyButton.textContent = "Copy prompt"; }, 1800);
      });
    }
  }

  function setupReflection() {
    const buttons = $$('[data-reflection]');
    const output = $("#reflectionText");
    if (!buttons.length || !output) return;
    const reflections = {
      r1: ["01 · WHAT PROBLEM DID I WANT TO ADDRESS?", "Knowing the names of technologies was not enough.", "My starting concern was that a traditional discussion could easily become a list of terms for learners to copy and memorize. ICT trends change quickly, and the issues surrounding them are rarely simple. I wanted learners to move past “What is AI?” or “What is cloud computing?” and begin asking, “Who benefits? What could go wrong? What evidence supports this claim? What should we do?” That shift—from recall to judgment—became the center of the redesign."],
      r2: ["02 · HOW DID TECHNOLOGY IMPROVE THE LESSON?", "The website made thinking visible at the moment it happened.", "Technology improved the lesson most through pacing and feedback. Learners can open short explanations only when they need them, test a classification, see the correct relationship, and reconsider a decision before moving on. The website also connects the complete journey in one place instead of separating the lecture, activity sheet, and assessment. This does not remove the teacher; it gives the teacher better evidence about where to intervene."],
      r3: ["03 · WHY DID I SELECT THESE TOOLS?", "Each tool was chosen for a particular learning job.", "GitHub Pages provides a lightweight and customizable hub. Built-in JavaScript gives private, immediate feedback without collecting names. Google Forms can summarize a class baseline; Docs makes shared evidence and peer comments visible; Slides supports a concise public-facing product; Drive and Classroom organize access, feedback, and revision. I deliberately avoided adding tools that would only duplicate a printed worksheet on a screen."],
      r4: ["04 · HOW DID I KEEP THE PROJECT FOCUSED ON LEARNING?", "I wrote the evidence before polishing the interface.", "The official competency and the five measurable outcomes guided every major decision. The concept cards support explanation; the classification check measures distinction; the consequence cases require analysis; the AI checklist supports evaluation; and the impact brief measures creation. When a feature did not strengthen one of those outcomes or remove a learner barrier, it did not belong in the final design."],
      r5: ["05 · HOW DID I ADDRESS DIFFERENT NEEDS AND ABILITIES?", "Access had to be part of the design, not an extra page at the end.", "Learners can read, listen to the visible transcript, study structured visual cards, work alone or with a partner, and choose how to present the same level of thinking. The site works with keyboard or touch, scales to a phone, and uses no required video or large media download. A printable version, shared-device roles, offline drafting, and flexible upload options keep weak connectivity from becoming a measure of academic ability."],
      r6: ["06 · WHAT DIFFICULTIES DID I ENCOUNTER?", "The hardest part was balancing currency, simplicity, and accuracy.", "ICT examples can become outdated quickly, but Grade 7 learners also need explanations that are not overloaded with technical language. I had to choose broad trends that remain relevant, connect them to authentic issues, and avoid presenting technology as completely good or bad. Another challenge was designing interaction that still made sense when printed or used without a personal device."],
      r7: ["07 · WHAT DID I LEARN AS A TEACHER AND DESIGNER?", "Innovation is strongest when it makes a decision more thoughtful.", "I learned that an attractive website is not yet a digital curriculum. The real design work is the relationship among outcomes, learner activity, feedback, assessment, and access. TPACK helped me see that content accuracy, pedagogy, and technology must support one another. SAMR was useful only when I asked what new learning interaction became possible, while UDL reminded me to anticipate barriers before learners encounter them."],
      r8: ["08 · WHAT WOULD I IMPROVE AFTER IMPLEMENTATION?", "The next version should respond to real learner evidence.", "After implementation, I would compare the diagnostic results with the case responses and rubric scores, then interview a small group of learners about unclear wording, pacing, and device barriers. I would replace examples that no longer feel current, add a learner-created local case gallery, and prepare Hiligaynon or Filipino language support where it improves comprehension. I would also review how safely and honestly learners use AI so that the prompt guide can become more precise."],
    };
    buttons.forEach((button) => button.addEventListener("click", () => {
      buttons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const [eyebrow, title, text] = reflections[button.dataset.reflection];
      output.innerHTML = `<p class="eyebrow">${eyebrow}</p><h3>${title}</h3><p>${text}</p>`;
    }));
  }

  function setupSpeech() {
    const button = $("#readSummary");
    const text = $("#summaryText");
    if (!button || !text) return;
    if (!("speechSynthesis" in window)) {
      button.disabled = true;
      button.title = "Speech is not supported in this browser";
      return;
    }
    let speaking = false;
    button.addEventListener("click", () => {
      if (speaking) {
        speechSynthesis.cancel();
        speaking = false;
        button.textContent = "▶";
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text.textContent);
      utterance.lang = "en-PH";
      utterance.rate = .92;
      utterance.onend = () => { speaking = false; button.textContent = "▶"; };
      utterance.onerror = () => { speaking = false; button.textContent = "▶"; };
      speechSynthesis.speak(utterance);
      speaking = true;
      button.textContent = "■";
    });
  }

  function setupMediaDemo() {
    const output = $("#demoFeedback");
    $$('[data-demo-answer]').forEach((button) => button.addEventListener("click", () => {
      output.textContent = button.dataset.demoAnswer === "trend"
        ? "Example: growing use of smart sensors. Ask: what is changing?"
        : "Example: stolen data from weak security. Ask: what needs attention?";
    }));
  }

  function setupPreferences() {
    const saved = storage.get(preferencesKey, { largeText: false, highContrast: false });
    document.body.classList.toggle("large-text", Boolean(saved.largeText));
    document.body.classList.toggle("high-contrast", Boolean(saved.highContrast));
    const textButton = $("#textToggle");
    const contrastButton = $("#contrastToggle");
    const save = () => storage.set(preferencesKey, {
      largeText: document.body.classList.contains("large-text"),
      highContrast: document.body.classList.contains("high-contrast")
    });
    textButton?.addEventListener("click", () => {
      document.body.classList.toggle("large-text");
      textButton.textContent = document.body.classList.contains("large-text") ? "A−" : "A+";
      textButton.setAttribute("aria-label", document.body.classList.contains("large-text") ? "Use standard text size" : "Increase text size");
      save();
    });
    contrastButton?.addEventListener("click", () => {
      document.body.classList.toggle("high-contrast");
      contrastButton.setAttribute("aria-pressed", String(document.body.classList.contains("high-contrast")));
      save();
    });
    if (saved.largeText && textButton) textButton.textContent = "A−";
    if (contrastButton) contrastButton.setAttribute("aria-pressed", String(Boolean(saved.highContrast)));
  }

  function setupMenu() {
    const button = $("#menuToggle");
    const nav = $("#siteNav");
    if (!button || !nav) return;
    button.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      button.setAttribute("aria-expanded", String(open));
    });
    $$('a', nav).forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    }));
  }

  function setupScrollEffects() {
    const progress = $("#readingProgress");
    const updateReadingProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      if (progress) progress.style.width = `${Math.min(100, percent)}%`;
    };
    window.addEventListener("scroll", updateReadingProgress, { passive: true });
    updateReadingProgress();

    const revealItems = $$('.reveal');
    if ("IntersectionObserver" in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: .08, rootMargin: "0px 0px -35px" });
      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add("visible"));
    }

    const navLinks = $$('#siteNav a');
    const sections = navLinks.map((link) => $(link.getAttribute("href"))).filter(Boolean);
    if ("IntersectionObserver" in window) {
      const navObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
          }
        });
      }, { rootMargin: "-25% 0px -65% 0px" });
      sections.forEach((section) => navObserver.observe(section));
    }
  }

  function setupReset() {
    const button = $("#resetProgress");
    button?.addEventListener("click", () => {
      const confirmed = window.confirm("Reset saved lesson progress and clear all checked answers on this device?");
      if (!confirmed) return;
      storage.remove(progressKey);
      completedStops = [];
      $$('form').forEach((form) => form.reset());
      $$('[data-task-check]').forEach((check) => { check.checked = false; });
      $$('.correct, .incorrect, .show').forEach((item) => item.classList.remove("correct", "incorrect", "show", "success", "review"));
      updateLessonProgress();
      const taskStatus = $("#taskCheckStatus");
      if (taskStatus) taskStatus.textContent = "0 of 5 checked";
    });
  }

  function setupPrint() {
    $("#printPage")?.addEventListener("click", () => window.print());
    let previouslyOpen = [];
    window.addEventListener("beforeprint", () => {
      const details = $$('details');
      previouslyOpen = details.filter((item) => item.open);
      details.forEach((item) => { item.open = true; });
    });
    window.addEventListener("afterprint", () => {
      $$('details').forEach((item) => { item.open = previouslyOpen.includes(item); });
    });
  }

  function init() {
    setupPreferences();
    setupMenu();
    setupScrollEffects();
    updateLessonProgress();
    setupReset();
    setupPrint();
    setupClassificationQuiz();
    setupTaskChecklist();
    setupFormatChoices();
    setupPromptLab();
    setupReflection();
    setupSpeech();
    setupMediaDemo();

    scoreRadioQuiz(
      $("#diagnosticQuiz"),
      $("#diagnosticResult"),
      "diagnostic",
      {
        pass: "Strong starting signal. Continue to the concept cards and look for connections between each trend and issue.",
        review: "This is useful baseline evidence. Focus on the difference between what is changing (trend) and what needs attention (issue)."
      }
    );
    scoreRadioQuiz(
      $("#caseQuiz"),
      $("#caseResult"),
      "decision",
      {
        pass: "Your decisions use evidence, privacy, access, and safety as criteria. You are ready to create an ICT Impact Brief.",
        review: "Review each rationale. A responsible response should protect people, verify evidence, and keep the learning goal accessible. Then try again."
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
