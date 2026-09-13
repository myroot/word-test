// script.js - Smart Word Memorizer Application Logic

(() => {
  // DOM Elements
  const unitSelect = document.getElementById('unitSelect');
  const tabLearn = document.getElementById('tabLearn');
  const tabTest = document.getElementById('tabTest');
  const learnSection = document.getElementById('learnSection');
  const testSection = document.getElementById('testSection');
  
  const progressText = document.getElementById('progressText');
  const unitBadge = document.getElementById('unitBadge');
  const progressBar = document.getElementById('progressBar');

  // Learning Mode Elements
  const flashcard = document.getElementById('flashcard');
  const cardWord = document.getElementById('cardWord');
  const cardPosFront = document.getElementById('cardPosFront');
  const cardMeaning = document.getElementById('cardMeaning');
  const cardEnglishMeaning = document.getElementById('cardEnglishMeaning');
  const cardSampleSentence = document.getElementById('cardSampleSentence');
  
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const flipBtn = document.getElementById('flipBtn');
  const ttsBtn = document.getElementById('ttsBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const autoPlayBtn = document.getElementById('autoPlayBtn');

  // Test Mode Elements
  const testPrompt = document.getElementById('testPrompt');
  const testPos = document.getElementById('testPos');
  const testExtraHint = document.getElementById('testExtraHint');
  const currentScoreEl = document.getElementById('currentScore');
  const totalTestCountEl = document.getElementById('totalTestCount');
  const slotsContainer = document.getElementById('slotsContainer');
  const testFeedback = document.getElementById('testFeedback');
  const hintBtn = document.getElementById('hintBtn');
  const backspaceBtn = document.getElementById('backspaceBtn');

  // Result Modal Elements
  const resultModal = document.getElementById('resultModal');
  const resultEmoji = document.getElementById('resultEmoji');
  const resultTitle = document.getElementById('resultTitle');
  const finalScoreEl = document.getElementById('finalScore');
  const finalTotalEl = document.getElementById('finalTotal');
  const finalAccuracyEl = document.getElementById('finalAccuracy');
  const wrongWordsList = document.getElementById('wrongWordsList');
  const wrongWordsUl = document.getElementById('wrongWordsUl');
  const retryWrongBtn = document.getElementById('retryWrongBtn');
  const restartTestBtn = document.getElementById('restartTestBtn');
  const closeResultBtn = document.getElementById('closeResultBtn');

  // State variables
  let rawWordsData = [];
  let currentWords = [];
  let currentIndex = 0;
  let currentMode = 'learn'; // 'learn' or 'test'
  let isFlipped = false;
  let autoPlayTimer = null;

  // Test mode state
  let testScore = 0;
  let testInputChars = [];
  let currentTargetWord = '';
  let wrongWords = [];
  let isTestingWrongWordsOnly = false;
  let isAnswerChecked = false;

  // Audio Context for sound effects
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
  };

  const playSound = (type) => {
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        osc.frequency.exponentialRampToValueAtTime(130.81, audioCtx.currentTime + 0.25); // C3
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      }
    } catch (e) {
      console.log('Audio playback error:', e);
    }
  };

  // Text to speech function
  const speakWord = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Load words from JSON
  fetch('words.json')
    .then(res => res.json())
    .then(data => {
      rawWordsData = data;
      filterWordsByUnit();
      updateProgressUI();
      renderCurrentModeCard();
    })
    .catch(err => {
      console.error('Failed to load words.json:', err);
    });

  // Filter words by selected unit
  const filterWordsByUnit = () => {
    const selectedUnit = unitSelect.value;
    if (selectedUnit === 'all') {
      currentWords = [...rawWordsData];
    } else {
      currentWords = rawWordsData.filter(item => item.unit === selectedUnit);
    }
    currentIndex = 0;
    isTestingWrongWordsOnly = false;
  };

  // Update UI Progress text and bar
  const updateProgressUI = () => {
    if (currentWords.length === 0) return;
    const total = currentWords.length;
    const current = currentIndex + 1;
    progressText.textContent = `진행도: ${current} / ${total}`;
    unitBadge.textContent = currentWords[currentIndex]?.unit || '단어장';
    const percent = ((current) / total) * 100;
    progressBar.style.width = `${percent}%`;
  };

  // Render content based on current mode
  const renderCurrentModeCard = () => {
    if (currentWords.length === 0) return;
    if (currentMode === 'learn') {
      showLearnCard();
    } else {
      showTestCard();
    }
  };

  // --------------------------------------------------------------------------
  // LEARNING MODE LOGIC
  // --------------------------------------------------------------------------
  const showLearnCard = () => {
    if (currentIndex >= currentWords.length) {
      currentIndex = 0;
    }
    const item = currentWords[currentIndex];
    
    // Reset flip state
    isFlipped = false;
    flashcard.classList.remove('flipped');

    // Fill Front
    cardWord.textContent = item.eng;
    cardPosFront.textContent = item.pos || '';

    // Fill Back
    cardMeaning.textContent = item.kor;
    cardEnglishMeaning.textContent = item.englishMeaning ? `영영: ${item.englishMeaning}` : '';
    cardSampleSentence.textContent = item.sampleSentence ? `예문: "${item.sampleSentence}"` : '';

    updateProgressUI();
  };

  const flipCard = () => {
    isFlipped = !isFlipped;
    flashcard.classList.toggle('flipped', isFlipped);
    playSound('click');
  };

  const nextLearnWord = () => {
    if (currentIndex < currentWords.length - 1) {
      currentIndex++;
    } else {
      currentIndex = 0; // loop back
    }
    showLearnCard();
  };

  const prevLearnWord = () => {
    if (currentIndex > 0) {
      currentIndex--;
    } else {
      currentIndex = currentWords.length - 1;
    }
    showLearnCard();
  };

  const toggleAutoPlay = () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
      autoPlayBtn.classList.remove('active');
      autoPlayBtn.querySelector('.btn-text').textContent = '자동 재생';
    } else {
      autoPlayBtn.classList.add('active');
      autoPlayBtn.querySelector('.btn-text').textContent = '일시 정지';
      autoPlayTimer = setInterval(() => {
        if (!isFlipped) {
          flipCard();
        } else {
          nextLearnWord();
        }
      }, 2500);
    }
  };

  // --------------------------------------------------------------------------
  // TEST MODE LOGIC
  // --------------------------------------------------------------------------
  const showTestCard = () => {
    if (currentIndex >= currentWords.length) {
      finishTest();
      return;
    }

    const item = currentWords[currentIndex];
    currentTargetWord = item.eng.toUpperCase();
    testInputChars = [];
    isAnswerChecked = false;

    // Reset feedback
    testFeedback.textContent = '';
    testFeedback.className = 'test-feedback';

    // Header info
    testPrompt.textContent = item.kor;
    testPos.textContent = item.pos || '';
    testExtraHint.textContent = item.englishMeaning ? `(영영: ${item.englishMeaning})` : '';

    totalTestCountEl.textContent = currentWords.length;
    currentScoreEl.textContent = testScore;

    renderSlots();
    updateProgressUI();
  };

  // Render slots for target word
  const renderSlots = () => {
    slotsContainer.innerHTML = '';
    
    let currentInputIdx = 0;

    for (let i = 0; i < currentTargetWord.length; i++) {
      const char = currentTargetWord[i];
      if (char === ' ') {
        // Space slot separator
        const spaceDiv = document.createElement('div');
        spaceDiv.className = 'letter-slot space-slot';
        slotsContainer.appendChild(spaceDiv);
      } else {
        const slot = document.createElement('div');
        slot.className = 'letter-slot';
        slot.dataset.index = i;

        const typedChar = testInputChars[currentInputIdx];
        if (typedChar) {
          slot.textContent = typedChar;
          slot.classList.add('filled');
        }

        // Active slot highlight
        if (currentInputIdx === testInputChars.length && !isAnswerChecked) {
          slot.classList.add('active');
        }

        slotsContainer.appendChild(slot);
        currentInputIdx++;
      }
    }
  };

  // Count non-space letters in target word
  const getTargetLetterCount = () => {
    return currentTargetWord.replace(/ /g, '').length;
  };

  // Handle letter typing
  const handleTypeLetter = (letter) => {
    if (isAnswerChecked) return;
    const targetLength = getTargetLetterCount();
    if (testInputChars.length >= targetLength) return;

    playSound('click');
    testInputChars.push(letter.toUpperCase());
    renderSlots();

    if (testInputChars.length === targetLength) {
      checkAnswer();
    }
  };

  // Handle Backspace
  const handleBackspace = () => {
    if (isAnswerChecked || testInputChars.length === 0) return;
    playSound('click');
    testInputChars.pop();
    renderSlots();
  };

  // Handle Hint Button
  const handleHint = () => {
    if (isAnswerChecked) return;
    const cleanTarget = currentTargetWord.replace(/ /g, '');
    const currentPos = testInputChars.length;
    if (currentPos < cleanTarget.length) {
      handleTypeLetter(cleanTarget[currentPos]);
    }
  };

  // Check Answer
  const checkAnswer = () => {
    isAnswerChecked = true;
    const entered = testInputChars.join('');
    const cleanTarget = currentTargetWord.replace(/ /g, '');

    const currentItem = currentWords[currentIndex];

    if (entered === cleanTarget) {
      playSound('correct');
      testScore++;
      currentScoreEl.textContent = testScore;
      testFeedback.textContent = '🎉 정답입니다!';
      testFeedback.className = 'test-feedback correct';

      setTimeout(() => {
        currentIndex++;
        showTestCard();
      }, 1200);
    } else {
      playSound('wrong');
      wrongWords.push(currentItem);
      testFeedback.textContent = `❌ 오답입니다! (정답: ${currentItem.eng})`;
      testFeedback.className = 'test-feedback wrong';

      setTimeout(() => {
        currentIndex++;
        showTestCard();
      }, 2000);
    }
  };

  // Finish Test & Show Modal
  const finishTest = () => {
    finalScoreEl.textContent = testScore;
    finalTotalEl.textContent = currentWords.length;
    const acc = Math.round((testScore / currentWords.length) * 100);
    finalAccuracyEl.textContent = `${acc}%`;

    if (acc === 100) {
      resultEmoji.textContent = '🏆';
      resultTitle.textContent = '만점입니다! 축하합니다!';
    } else if (acc >= 70) {
      resultEmoji.textContent = '👏';
      resultTitle.textContent = '수고하셨습니다!';
    } else {
      resultEmoji.textContent = '💪';
      resultTitle.textContent = '조금 더 연습해보세요!';
    }

    if (wrongWords.length > 0) {
      wrongWordsList.classList.remove('hidden');
      retryWrongBtn.classList.remove('hidden');
      wrongWordsUl.innerHTML = '';
      wrongWords.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="wrong-eng">${item.eng}</span> <span>${item.kor}</span>`;
        wrongWordsUl.appendChild(li);
      });
    } else {
      wrongWordsList.classList.add('hidden');
      retryWrongBtn.classList.add('hidden');
    }

    resultModal.classList.remove('hidden');
  };

  // Reset Test Mode State
  const startTestMode = (wordsToTest = currentWords) => {
    currentWords = wordsToTest;
    currentIndex = 0;
    testScore = 0;
    wrongWords = [];
    resultModal.classList.add('hidden');
    showTestCard();
  };

  // --------------------------------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------------------------------

  // Mode Tabs
  tabLearn.addEventListener('click', () => {
    currentMode = 'learn';
    tabLearn.classList.add('active');
    tabTest.classList.remove('active');
    learnSection.classList.remove('hidden');
    testSection.classList.add('hidden');
    renderCurrentModeCard();
  });

  tabTest.addEventListener('click', () => {
    currentMode = 'test';
    tabTest.classList.add('active');
    tabLearn.classList.remove('active');
    testSection.classList.remove('hidden');
    learnSection.classList.add('hidden');
    startTestMode();
  });

  // Unit filter dropdown
  unitSelect.addEventListener('change', () => {
    filterWordsByUnit();
    if (currentMode === 'test') {
      startTestMode();
    } else {
      renderCurrentModeCard();
    }
  });

  // Learning Flashcard clicks
  flashcard.addEventListener('click', flipCard);
  flipBtn.addEventListener('click', flipCard);
  nextBtn.addEventListener('click', nextLearnWord);
  prevBtn.addEventListener('click', prevLearnWord);

  ttsBtn.addEventListener('click', () => {
    if (currentWords[currentIndex]) {
      speakWord(currentWords[currentIndex].eng);
    }
  });

  shuffleBtn.addEventListener('click', () => {
    currentWords.sort(() => Math.random() - 0.5);
    currentIndex = 0;
    playSound('click');
    renderCurrentModeCard();
  });

  autoPlayBtn.addEventListener('click', toggleAutoPlay);

  // Virtual Keyboard buttons
  document.querySelectorAll('.key-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleTypeLetter(btn.dataset.key);
    });
  });

  backspaceBtn.addEventListener('click', handleBackspace);
  hintBtn.addEventListener('click', handleHint);

  // Physical Keyboard input listener
  window.addEventListener('keydown', (e) => {
    if (resultModal.classList.contains('hidden') === false) return;

    if (currentMode === 'learn') {
      if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
      } else if (e.code === 'ArrowRight') {
        nextLearnWord();
      } else if (e.code === 'ArrowLeft') {
        prevLearnWord();
      }
    } else if (currentMode === 'test') {
      if (e.key === 'Backspace') {
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleTypeLetter(e.key);
      }
    }
  });

  // Modal Actions
  retryWrongBtn.addEventListener('click', () => {
    isTestingWrongWordsOnly = true;
    startTestMode([...wrongWords]);
  });

  restartTestBtn.addEventListener('click', () => {
    filterWordsByUnit();
    startTestMode();
  });

  closeResultBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    tabLearn.click();
  });
})();
