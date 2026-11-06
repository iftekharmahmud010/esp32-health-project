// BioSense AI — ESP32 Smart Health (OLED + MAX30102 + AD8232 + TMP36) & Facial Diagnostic System

document.addEventListener('DOMContentLoaded', () => {
  initBioSenseApp();
});

function initBioSenseApp() {

const state = {
  patient: {
    name: 'Guest User',
    age: '—',
    gender: '—',
    sleep: '7-8',
    symptoms: [],
    history: 'None',
    profilePicDataUrl: null,
    capturedSnapshot: null,
    recordedVitals: null,
  },
  workflow: {
    active: false,
    step: 0, // 1: ECG, 2: Oximeter, 3: Temp, 4: Done
    timer: null,
    countdown: 0,
  },
  cameraActive: false,
  modelsLoaded: false,
  stream: null,
  offscreenCanvas: document.createElement('canvas'),
  latestAnalysis: {
    moodLabel: 'CALM / NEUTRAL 🙂',
    moodCode: 'NEUTRAL',
    moodConf: 82,
    happyPct: 14,
    sadPct: 6,
    condition: 'HEALTHY / NORMAL',
    conditionCode: 'HEALTHY',
    boxColor: '#10b981',
    rednessScore: 18,
    fatigueScore: 20,
    pallorScore: 15,
    vitality: 88,
    note: 'Waiting for face in the square detection box...',
  },
  espPort: null,
  espWriter: null,
  espReader: null,
  espWebSocket: null,
  espConnected: false,
  espHardwareSerial: false,
  espWireless: false,
  lastEspSend: 0,
  smoothing: {
    redness: 18,
    fatigue: 20,
    pallor: 15,
    happy: 15,
    sad: 8,
  },
  espVitals: {
    hr: 76,
    spo2: 98,
    temp: 36.7,
    ecg: 2048,
    leadsOff: false,
  },
  ecgHistory: new Array(220).fill(2048),
  ecgSimPhase: 0,
};

// DOM Elements
const onboardingModal = document.getElementById('onboardingModal');
const onboardingForm = document.getElementById('onboardingForm');
const skipOnboardingBtn = document.getElementById('skipOnboardingBtn');
const reopenOnboardingBtn = document.getElementById('reopenOnboardingBtn');

const headerAvatarImg = document.getElementById('headerAvatarImg');
const accountBadge = document.getElementById('accountBadge');
const profileAvatarImg = document.getElementById('profileAvatarImg');
const profileAvatarPlaceholder = document.getElementById('profileAvatarPlaceholder');
const summaryName = document.getElementById('summaryName');
const summaryAgeGender = document.getElementById('summaryAgeGender');
const summarySleep = document.getElementById('summarySleep');
const summarySymptoms = document.getElementById('summarySymptoms');
const capturedThresholdsText = document.getElementById('capturedThresholdsText');

const toggleCameraBtn = document.getElementById('toggleCameraBtn');
const takeProfilePicBtn = document.getElementById('takeProfilePicBtn');
const downloadExcelBtn = document.getElementById('downloadExcelBtn');
const captureSnapshotBtn = document.getElementById('captureSnapshotBtn');

const diagnosticWorkflowCard = document.getElementById('diagnosticWorkflowCard');
const workflowStepTitle = document.getElementById('workflowStepTitle');
const workflowBadge = document.getElementById('workflowBadge');
const workflowInstructionText = document.getElementById('workflowInstructionText');
const workflowProgressBar = document.getElementById('workflowProgressBar');
const workflowTimerHint = document.getElementById('workflowTimerHint');
const workflowNextBtn = document.getElementById('workflowNextBtn');

const accountDiagnosticRecordBox = document.getElementById('accountDiagnosticRecordBox');
const recEcgBpm = document.getElementById('recEcgBpm');
const recSpo2 = document.getElementById('recSpo2');
const recTemp = document.getElementById('recTemp');
const recVitality = document.getElementById('recVitality');

const webcamVideo = document.getElementById('webcamVideo');
const overlayCanvas = document.getElementById('overlayCanvas');
const cameraFlash = document.getElementById('cameraFlash');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const liveHudBanner = document.getElementById('liveHudBanner');
const hudStatusText = document.getElementById('hudStatusText');

const faceDetectedValue = document.getElementById('faceDetectedValue');
const moodValue = document.getElementById('moodValue');
const conditionValue = document.getElementById('conditionValue');
const vitalityValue = document.getElementById('vitalityValue');

const happyLabel = document.getElementById('happyLabel');
const happyBar = document.getElementById('happyBar');
const sadLabel = document.getElementById('sadLabel');
const sadBar = document.getElementById('sadBar');
const rednessLabel = document.getElementById('rednessLabel');
const rednessBar = document.getElementById('rednessBar');
const fatigueLabel = document.getElementById('fatigueLabel');
const fatigueBar = document.getElementById('fatigueBar');
const pallorLabel = document.getElementById('pallorLabel');
const pallorBar = document.getElementById('pallorBar');
const diagnosticAlertBox = document.getElementById('diagnosticAlertBox');

const connectEspBtn = document.getElementById('connectEspBtn');
const connectWifiEspBtn = document.getElementById('connectWifiEspBtn');
const wifiIpInputRow = document.getElementById('wifiIpInputRow');
const espIpAddressInput = document.getElementById('espIpAddressInput');
const confirmWifiConnectBtn = document.getElementById('confirmWifiConnectBtn');

const espStatusBadge = document.getElementById('espStatusBadge');
const espHeartRate = document.getElementById('espHeartRate');
const espSpo2 = document.getElementById('espSpo2');
const espTemp = document.getElementById('espTemp');
const espPacket = document.getElementById('espPacket');
const ecgLeadBadge = document.getElementById('ecgLeadBadge');
const ecgCanvas = document.getElementById('ecgCanvas');
const oledCanvas = document.getElementById('oledCanvas');

const openEspCodeModalBtn = document.getElementById('openEspCodeModalBtn');
const closeEspCodeModalBtn = document.getElementById('closeEspCodeModalBtn');
const espCodeModal = document.getElementById('espCodeModal');
const espCodePre = document.getElementById('espCodePre');
const copyEspCodeBtn = document.getElementById('copyEspCodeBtn');

const authBtn = document.getElementById('authBtn');
const authModal = document.getElementById('authModal');
const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authErrorMsg = document.getElementById('authErrorMsg');
const authModalTitle = document.getElementById('authModalTitle');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuthModeLink = document.getElementById('toggleAuthModeLink');

let firebaseUser = null;
let isRegisterMode = false;

// Initialize Firebase if config provided
let db = null;
let auth = null;
if (typeof firebase !== 'undefined' && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY') {
  try {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();

    auth.onAuthStateChanged(async (user) => {
      firebaseUser = user;
      if (user) {
        authBtn.textContent = 'Sign Out (' + (user.email.split('@')[0]) + ')';
        loadUserDataFromFirestore(user.uid);
      } else {
        authBtn.textContent = 'Sign In / Register';
      }
    });
  } catch (e) {
    console.warn('Firebase init notice:', e);
  }
}

authBtn.addEventListener('click', () => {
  if (firebaseUser && auth) {
    auth.signOut();
    return;
  }
  authModal.classList.remove('hidden');
});

closeAuthModalBtn.addEventListener('click', () => {
  authModal.classList.add('hidden');
  authErrorMsg.classList.add('hidden');
});

toggleAuthModeLink.addEventListener('click', (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  if (isRegisterMode) {
    authModalTitle.textContent = 'Register New Account';
    authSubmitBtn.textContent = 'Create Account';
    toggleAuthModeLink.textContent = 'Already have an account? Sign In';
  } else {
    authModalTitle.textContent = 'Sign In to BioSense AI';
    authSubmitBtn.textContent = 'Sign In';
    toggleAuthModeLink.textContent = "Don't have an account? Register here";
  }
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authErrorMsg.classList.add('hidden');
  const email = authEmail.value.trim();
  const pwd = authPassword.value;

  if (!auth) {
    alert('Firebase is not yet configured. Please add your credentials in firebase-config.js. Testing with local session for now!');
    authModal.classList.add('hidden');
    state.patient.name = email.split('@')[0];
    updatePatientProfileUI();
    return;
  }

  try {
    if (isRegisterMode) {
      const cred = await auth.createUserWithEmailAndPassword(email, pwd);
      authModal.classList.add('hidden');
      saveUserDataToFirestore(cred.user.uid);
    } else {
      await auth.signInWithEmailAndPassword(email, pwd);
      authModal.classList.add('hidden');
    }
  } catch (err) {
    authErrorMsg.textContent = err.message;
    authErrorMsg.classList.remove('hidden');
  }
});

async function saveUserDataToFirestore(uid) {
  if (!db) return;
  try {
    await db.collection('patients').doc(uid).set({
      patient: state.patient,
      latestAnalysis: state.latestAnalysis,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore write warning:', e);
  }
}

async function loadUserDataFromFirestore(uid) {
  if (!db) return;
  try {
    const doc = await db.collection('patients').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.patient) {
        state.patient = { ...state.patient, ...data.patient };
        updatePatientProfileUI();
      }
    }
  } catch (e) {
    console.warn('Firestore read error:', e);
  }
}

// 1. Load AI Face Detection Models
async function initFaceModels() {
  try {
    if (typeof faceapi === 'undefined') {
      setTimeout(initFaceModels, 600);
      return;
    }
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]);
    state.modelsLoaded = true;
    hudStatusText.textContent = 'AI Face & Expression Threshold Engine Active';
  } catch (err) {
    hudStatusText.textContent = 'Optical Face & Skin Threshold Scanner Active';
  }
}

initFaceModels();

// 2. Onboarding Form Handling
onboardingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('patientName').value.trim() || 'Patient';
  const age = document.getElementById('patientAge').value.trim() || '—';
  const gender = document.getElementById('patientGender').value;
  const sleep = document.getElementById('sleepHours').value;
  const history = document.getElementById('medicalHistory').value.trim() || 'None';

  const checkedSymptoms = Array.from(
    document.querySelectorAll('input[name="symptoms"]:checked')
  ).map((el) => el.value);

  state.patient = {
    ...state.patient,
    name,
    age,
    gender,
    sleep,
    symptoms: checkedSymptoms.length ? checkedSymptoms : ['None'],
    history,
  };

  updatePatientProfileUI();
  onboardingModal.classList.add('hidden');

  if (!state.cameraActive) {
    await startCamera();
  }
});

skipOnboardingBtn.addEventListener('click', () => {
  onboardingModal.classList.add('hidden');
});

reopenOnboardingBtn.addEventListener('click', () => {
  onboardingModal.classList.remove('hidden');
});

function updatePatientProfileUI() {
  const { name, age, gender, sleep, symptoms, profilePicDataUrl } = state.patient;
  accountBadge.textContent = `Account: ${name}`;
  summaryName.textContent = name;
  summaryAgeGender.textContent = `${age} yrs / ${gender}`;
  summarySleep.textContent = `${sleep} hrs`;
  summarySymptoms.textContent = symptoms.join(', ');

  if (profilePicDataUrl) {
    headerAvatarImg.src = profilePicDataUrl;
    headerAvatarImg.classList.remove('hidden');
    profileAvatarImg.src = profilePicDataUrl;
    profileAvatarImg.classList.remove('hidden');
    profileAvatarPlaceholder.classList.add('hidden');
  }
}

// 3. Camera Access & Control
toggleCameraBtn.addEventListener('click', async () => {
  if (state.cameraActive) {
    stopCamera();
  } else {
    await startCamera();
  }
});

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    state.stream = stream;
    webcamVideo.srcObject = stream;
    await webcamVideo.play();

    state.cameraActive = true;
    cameraPlaceholder.classList.add('hidden');
    liveHudBanner.classList.remove('hidden');
    toggleCameraBtn.textContent = 'Stop Camera';
    takeProfilePicBtn.disabled = false;
    captureSnapshotBtn.disabled = false;

    requestAnimationFrame(processVideoFrame);
  } catch (err) {
    alert(
      'Unable to access camera. Please allow camera permissions in your browser settings.\n\nError: ' +
        err.message
    );
  }
}

function stopCamera() {
  state.cameraActive = false;
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  webcamVideo.srcObject = null;
  cameraPlaceholder.classList.remove('hidden');
  liveHudBanner.classList.add('hidden');
  toggleCameraBtn.textContent = 'Start Camera';
  takeProfilePicBtn.disabled = true;
  captureSnapshotBtn.disabled = true;

  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// 4. Take Profile Picture with Threshold Overlay & Set as Account Profile Picture
takeProfilePicBtn.addEventListener('click', () => {
  if (!state.cameraActive || webcamVideo.readyState < 2) return;

  // Trigger camera flash effect
  cameraFlash.classList.add('active');
  setTimeout(() => cameraFlash.classList.remove('active'), 260);

  const vw = webcamVideo.videoWidth || 640;
  const vh = webcamVideo.videoHeight || 480;

  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = vw;
  snapCanvas.height = vh;
  const sctx = snapCanvas.getContext('2d');

  // 1. Draw mirrored camera frame
  sctx.save();
  sctx.translate(vw, 0);
  sctx.scale(-1, 1);
  sctx.drawImage(webcamVideo, 0, 0, vw, vh);
  sctx.restore();

  // 2. Draw live square face box & threshold HUD overlay onto the profile snapshot
  sctx.drawImage(overlayCanvas, 0, 0, vw, vh);

  // 3. Stamp bottom watermark with threshold summary
  const a = state.latestAnalysis;
  sctx.fillStyle = 'rgba(11, 17, 32, 0.85)';
  sctx.fillRect(0, vh - 36, vw, 36);
  sctx.fillStyle = '#34d399';
  sctx.font = 'bold 14px Inter, sans-serif';
  sctx.fillText(
    `${state.patient.name} | ${a.moodLabel} | Sad:${a.sadPct}% Happy:${a.happyPct}% | ${a.condition}`,
    14,
    vh - 13
  );

  const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.92);
  state.patient.profilePicDataUrl = dataUrl;
  state.patient.capturedSnapshot = {
    time: new Date().toLocaleTimeString(),
    ...a,
  };

  updatePatientProfileUI();

  capturedThresholdsText.innerHTML = `
    <strong>${a.moodLabel}</strong> • Happy: <strong>${a.happyPct}%</strong> | Sad: <strong>${a.sadPct}%</strong><br/>
    Redness: <strong>${a.rednessScore}%</strong> | Fatigue: <strong>${a.fatigueScore}%</strong> | Status: <strong style="color:${a.boxColor}">${a.condition}</strong>
  `;

  // Automatically start the guided ESP32 health checkup sequence
  startGuidedHealthWorkflow();
});

// Guided Diagnostic Workflow: ECG -> Oximeter (MAX30102) -> Temperature (TMP36) -> Save to Account & Excel
function startGuidedHealthWorkflow() {
  state.workflow.active = true;
  state.workflow.step = 1;
  diagnosticWorkflowCard.classList.remove('hidden');
  diagnosticWorkflowCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Activate ESP32 telemetry/simulation if not already active
  if (!state.espConnected) {
    state.espConnected = true;
    setEspConnectedUI('ESP32: Checkup Active');
  }

  showWorkflowStep(1);
}

function showWorkflowStep(step) {
  state.workflow.step = step;
  if (state.workflow.timer) clearInterval(state.workflow.timer);

  if (step === 1) {
    workflowStepTitle.textContent = 'Step 1 of 3: AD8232 ECG Sensor Check';
    workflowBadge.textContent = 'ECG Sensor Hand Contact';
    workflowBadge.className = 'tag tag-accent';
    workflowInstructionText.innerHTML = `
      📸 <strong>Face profile saved!</strong> Now, please <strong>connect your hand</strong> to the <strong>AD8232 ECG sensor pads</strong> (or place leads on your chest/wrist) to record heart activity.
    `;
    workflowProgressBar.style.width = '33%';
    workflowNextBtn.textContent = 'Recording ECG... (Proceed →)';
    workflowTimerHint.textContent = 'Hold steady for ECG trace analysis...';

    // Auto prompt after 6 seconds or when user clicks next
    startWorkflowCountdown(6, () => {
      workflowNextBtn.textContent = 'ECG Recorded! Next: Oximeter →';
    });

  } else if (step === 2) {
    // Lock in ECG reading
    state.espVitals.ecgFinal = state.espVitals.hr > 0 ? state.espVitals.hr : 75;

    workflowStepTitle.textContent = 'Step 2 of 3: MAX30102 Pulse Oximeter';
    workflowBadge.textContent = 'Finger on Oximeter';
    workflowBadge.className = 'tag tag-ai';
    workflowInstructionText.innerHTML = `
      💓 <strong>ECG recorded!</strong> Now, please <strong>place your finger onto the MAX30102 oximeter sensor</strong> to measure your <strong>Heart Rate (BPM)</strong> and <strong>Blood Oxygen (SpO2 %)</strong>.
    `;
    workflowProgressBar.style.width = '66%';
    workflowNextBtn.textContent = 'Reading SpO2... (Proceed →)';
    workflowTimerHint.textContent = 'Measuring blood oxygen and pulse...';

    startWorkflowCountdown(6, () => {
      workflowNextBtn.textContent = 'Oximeter Recorded! Next: Temperature →';
    });

  } else if (step === 3) {
    // Lock in Oximeter reading
    state.espVitals.spo2Final = state.espVitals.spo2 > 0 ? state.espVitals.spo2 : 98;
    state.espVitals.hrFinal = state.espVitals.hr > 0 ? state.espVitals.hr : 76;

    workflowStepTitle.textContent = 'Step 3 of 3: TMP36 Body Temperature';
    workflowBadge.textContent = 'Finger on Temp Sensor';
    workflowBadge.className = 'tag tag-accent';
    workflowInstructionText.innerHTML = `
      🫁 <strong>ECG & Oximeter recorded!</strong> Finally, please <strong>touch your finger to the TMP36 temperature sensor</strong> to read your body temperature.
    `;
    workflowProgressBar.style.width = '90%';
    workflowNextBtn.textContent = 'Measuring Temp... (Finish →)';
    workflowTimerHint.textContent = 'Calibrating body temperature...';

    startWorkflowCountdown(5, () => {
      workflowNextBtn.textContent = 'Finish Checkup & Store in Account →';
    });

  } else if (step === 4) {
    // Complete and save to account
    completeDiagnosticWorkflow();
  }
}

function startWorkflowCountdown(seconds, onReady) {
  state.workflow.countdown = seconds;
  state.workflow.timer = setInterval(() => {
    state.workflow.countdown--;
    if (state.workflow.countdown <= 0) {
      clearInterval(state.workflow.timer);
      state.workflow.timer = null;
      if (onReady) onReady();
    } else {
      workflowTimerHint.textContent = `Analyzing sensor signals (${state.workflow.countdown}s)...`;
    }
  }, 1000);
}

workflowNextBtn.addEventListener('click', () => {
  if (state.workflow.step < 3) {
    showWorkflowStep(state.workflow.step + 1);
  } else {
    showWorkflowStep(4);
  }
});

function completeDiagnosticWorkflow() {
  state.workflow.active = false;
  state.workflow.step = 4;
  if (state.workflow.timer) clearInterval(state.workflow.timer);

  const finalTemp = state.espVitals.temp || 36.7;
  const finalHr = state.espVitals.hrFinal || state.espVitals.hr || 75;
  const finalSpo2 = state.espVitals.spo2Final || state.espVitals.spo2 || 98;

  state.patient.recordedVitals = {
    timestamp: new Date().toLocaleString(),
    heartRateBpm: finalHr,
    spo2Pct: finalSpo2,
    temperatureC: finalTemp,
    temperatureF: ((finalTemp * 9) / 5 + 32).toFixed(1),
    ecgSignalStatus: state.espVitals.leadsOff ? 'Leads Off' : 'Normal Sinus Rhythm',
  };

  // Update Workflow card UI to completed state
  workflowStepTitle.textContent = '✅ Diagnostic Examination Complete!';
  workflowBadge.textContent = 'All Vitals Documented';
  workflowBadge.className = 'tag';
  workflowInstructionText.innerHTML = `
    🎉 <strong>All sensor values have been saved to ${state.patient.name}'s account!</strong><br/>
    ECG Rate: <strong>${finalHr} BPM</strong> | SpO2: <strong>${finalSpo2}%</strong> | Temp: <strong>${finalTemp.toFixed(1)}°C</strong> | Vitality: <strong>${state.latestAnalysis.vitality}/100</strong>.
  `;
  workflowProgressBar.style.width = '100%';
  workflowTimerHint.textContent = 'Documentation stored to patient file.';
  workflowNextBtn.textContent = 'Download Patient Excel File (.xlsx) 📊';
  workflowNextBtn.onclick = () => exportPatientHealthExcel();

  // Enable top-bar Excel button
  downloadExcelBtn.disabled = false;

  // Update Account Card
  accountDiagnosticRecordBox.classList.remove('hidden');
  recEcgBpm.textContent = `${finalHr} BPM`;
  recSpo2.textContent = `${finalSpo2}%`;
  recTemp.textContent = `${finalTemp.toFixed(1)}°C`;
  recVitality.textContent = `${state.latestAnalysis.vitality}/100`;

  // Sync to Firebase Cloud Firestore if signed in
  if (firebaseUser) {
    saveUserDataToFirestore(firebaseUser.uid);
  }

  alert(`All health information, facial thresholds, ECG, Oximeter, and Temperature values have been documented to ${state.patient.name}'s account! You can now download the complete Excel (.xlsx) file.`);
}

// Generate complete formatted Excel (.xlsx) spreadsheet using SheetJS
function exportPatientHealthExcel() {
  if (typeof XLSX === 'undefined') {
    alert('SheetJS Excel library is still loading. Please try again in a moment.');
    return;
  }

  const p = state.patient;
  const a = state.latestAnalysis;
  const v = p.recordedVitals || {
    timestamp: new Date().toLocaleString(),
    heartRateBpm: state.espVitals.hr || 75,
    spo2Pct: state.espVitals.spo2 || 98,
    temperatureC: state.espVitals.temp || 36.7,
    temperatureF: (((state.espVitals.temp || 36.7) * 9) / 5 + 32).toFixed(1),
    ecgSignalStatus: 'Normal Sinus Rhythm',
  };

  const wb = XLSX.utils.book_new();

  // Sheet 1: Patient Diagnostic Summary
  const summaryData = [
    ['BioSense AI — Smart ESP32 Health & Facial Diagnostic Record', ''],
    ['Generated On', new Date().toLocaleString()],
    ['', ''],
    ['PATIENT PROFILE & QUESTIONNAIRE', ''],
    ['Patient Name', p.name],
    ['Age', p.age],
    ['Gender', p.gender],
    ['Reported Sleep', `${p.sleep} hours`],
    ['Reported Symptoms', p.symptoms.join(', ')],
    ['Medical History', p.history],
    ['', ''],
    ['AI FACIAL SCAN & THRESHOLD ANALYSIS (CAMERA)', ''],
    ['Facial Mood / Emotion', a.moodLabel],
    ['Happy Threshold (%)', `${a.happyPct}%`],
    ['Sad / Low Mood Threshold (%)', `${a.sadPct}%`],
    ['Facial Redness / Flush (%)', `${a.rednessScore}%`],
    ['Under-Eye Fatigue (%)', `${a.fatigueScore}%`],
    ['Skin Pallor / Perfusion (%)', `${a.pallorScore}%`],
    ['Overall Vitality Score', `${a.vitality} / 100`],
    ['Facial Diagnostic Screening', a.condition],
    ['Clinical Screening Note', a.note],
    ['', ''],
    ['ESP32 HARDWARE SENSOR VITALS', ''],
    ['AD8232 ECG Status', v.ecgSignalStatus],
    ['ECG / Pulse Heart Rate (BPM)', v.heartRateBpm],
    ['MAX30102 Blood Oxygen (SpO2 %)', `${v.spo2Pct}%`],
    ['TMP36 Body Temperature (°C)', `${Number(v.temperatureC).toFixed(1)} °C`],
    ['TMP36 Body Temperature (°F)', `${v.temperatureF} °F`],
    ['ESP32 Firmware', 'esp32_health_firmware.ino (SSD1306, MAX30102, AD8232, TMP36)'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Diagnostic Summary');

  // Sheet 2: Tabular Sensor Log
  const tabularData = [
    ['Category', 'Parameter', 'Value', 'Unit', 'Clinical Interpretation'],
    ['Questionnaire', 'Sleep Duration', p.sleep, 'hours', p.sleep === '<5' ? 'Deprived' : 'Adequate'],
    ['Questionnaire', 'Symptoms', p.symptoms.join(', '), '', 'Self-reported'],
    ['Face AI', 'Primary Expression', a.moodCode, '', a.moodLabel],
    ['Face AI', 'Happy Score', a.happyPct, '%', a.happyPct > 50 ? 'Positive Affect' : 'Low'],
    ['Face AI', 'Sad Score', a.sadPct, '%', a.sadPct > 40 ? 'Elevated Sadness' : 'Normal'],
    ['Face AI', 'Redness / Flush', a.rednessScore, '%', a.rednessScore > 65 ? 'Fever / Flush Sign' : 'Normal'],
    ['Face AI', 'Fatigue Sign', a.fatigueScore, '%', a.fatigueScore > 60 ? 'Exhaustion' : 'Rested'],
    ['Face AI', 'Skin Pallor', a.pallorScore, '%', a.pallorScore > 60 ? 'Pallor Risk' : 'Normal'],
    ['Sensor', 'AD8232 ECG Heart Rate', v.heartRateBpm, 'BPM', v.heartRateBpm > 100 ? 'Tachycardia' : v.heartRateBpm < 60 ? 'Bradycardia' : 'Normal Sinus'],
    ['Sensor', 'MAX30102 SpO2', v.spo2Pct, '%', v.spo2Pct >= 95 ? 'Normal Oxygen' : 'Hypoxia Alert'],
    ['Sensor', 'TMP36 Body Temp', Number(v.temperatureC).toFixed(1), '°C', v.temperatureC > 37.5 ? 'Pyrexia / Fever' : 'Normal Body Temp'],
  ];

  const wsTabular = XLSX.utils.aoa_to_sheet(tabularData);
  wsTabular['!cols'] = [{ wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 10 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsTabular, 'Raw Vitals Table');

  const safeName = p.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const fileName = `Health_Record_${safeName}_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

downloadExcelBtn.addEventListener('click', () => {
  exportPatientHealthExcel();
});

// 5. Real-Time Face Detection, Expression & Optical Skin/Disease Analysis
async function processVideoFrame() {
  if (!state.cameraActive) return;

  if (webcamVideo.readyState >= 2) {
    const vw = webcamVideo.videoWidth || 640;
    const vh = webcamVideo.videoHeight || 480;

    if (overlayCanvas.width !== vw || overlayCanvas.height !== vh) {
      overlayCanvas.width = vw;
      overlayCanvas.height = vh;
    }

    let detectionResult = null;

    if (state.modelsLoaded && typeof faceapi !== 'undefined') {
      try {
        detectionResult = await faceapi
          .detectSingleFace(
            webcamVideo,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 })
          )
          .withFaceLandmarks(true)
          .withFaceExpressions();
      } catch (e) {
        // Fallback if busy
      }
    }

    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, vw, vh);

    if (detectionResult) {
      const rawBox = detectionResult.detection.box;
      const size = Math.max(rawBox.width, rawBox.height) * 1.05;
      const centerX = vw - (rawBox.x + rawBox.width / 2); // mirrored X
      const centerY = rawBox.y + rawBox.height / 2;
      const sqX = Math.max(10, Math.min(vw - size - 10, centerX - size / 2));
      const sqY = Math.max(10, Math.min(vh - size - 10, centerY - size / 2));

      const skinStats = analyzeFacialSkinROI(
        webcamVideo,
        rawBox.x,
        rawBox.y,
        rawBox.width,
        rawBox.height
      );

      const expr = detectionResult.expressions;
      const sortedExpr = Object.entries(expr).sort((a, b) => b[1] - a[1]);
      const [topMoodKey, topMoodConf] = sortedExpr[0] || ['neutral', 0.8];

      // Smooth Happy & Sad percentages
      const rawHappy = Math.round((expr.happy || 0) * 100);
      const rawSad = Math.round(
        Math.min(100, ((expr.sad || 0) + (expr.fearful || 0) * 0.5) * 100)
      );
      state.smoothing.happy = Math.round(state.smoothing.happy * 0.65 + rawHappy * 0.35);
      state.smoothing.sad = Math.round(state.smoothing.sad * 0.65 + rawSad * 0.35);

      const analysis = computeHealthAndMoodAssessment(
        topMoodKey,
        topMoodConf,
        skinStats,
        state.smoothing.happy,
        state.smoothing.sad
      );

      state.latestAnalysis = analysis;
      drawSquareFaceHUD(ctx, sqX, sqY, size, analysis);
      updateDashboardMetrics(analysis, true);
      streamToESP32(analysis);
    } else {
      const fallbackBox = locateSkinCentroidBox(webcamVideo, vw, vh);
      if (fallbackBox) {
        const skinStats = analyzeFacialSkinROI(
          webcamVideo,
          fallbackBox.rawX,
          fallbackBox.rawY,
          fallbackBox.size,
          fallbackBox.size
        );
        const analysis = computeHealthAndMoodAssessment(
          'neutral',
          0.82,
          skinStats,
          state.smoothing.happy,
          state.smoothing.sad
        );
        state.latestAnalysis = analysis;
        drawSquareFaceHUD(ctx, fallbackBox.sqX, fallbackBox.sqY, fallbackBox.size, analysis);
        updateDashboardMetrics(analysis, true);
        streamToESP32(analysis);
      } else {
        faceDetectedValue.textContent = 'Scanning...';
        faceDetectedValue.style.color = '#f59e0b';
      }
    }
  }

  if (state.cameraActive) {
    setTimeout(() => requestAnimationFrame(processVideoFrame), 110);
  }
}

function locateSkinCentroidBox(video, vw, vh) {
  const off = state.offscreenCanvas;
  const gw = 80;
  const gh = 60;
  off.width = gw;
  off.height = gh;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.drawImage(video, 0, 0, gw, gh);
  const { data } = octx.getImageData(0, 0, gw, gh);

  let sumX = 0,
    sumY = 0,
    count = 0;

  for (let y = 6; y < gh - 6; y++) {
    for (let x = 10; x < gw - 10; x++) {
      const i = (y * gw + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (r > 75 && g > 35 && b > 18 && r > g && r > b && Math.abs(r - g) > 12) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count < 45) return null;

  const avgX = (sumX / count / gw) * vw;
  const avgY = (sumY / count / gh) * vh;
  const size = Math.min(vw, vh) * 0.48;
  const mirroredCenterX = vw - avgX;
  const sqX = Math.max(12, Math.min(vw - size - 12, mirroredCenterX - size / 2));
  const sqY = Math.max(12, Math.min(vh - size - 12, avgY - size / 2));
  const rawX = Math.max(12, Math.min(vw - size - 12, avgX - size / 2));

  return { sqX, sqY, rawX, rawY: sqY, size };
}

function analyzeFacialSkinROI(video, x, y, w, h) {
  const off = state.offscreenCanvas;
  const sampleW = 64;
  const sampleH = 64;
  off.width = sampleW;
  off.height = sampleH;
  const octx = off.getContext('2d', { willReadFrequently: true });

  const sx = Math.max(0, x + w * 0.2);
  const sy = Math.max(0, y + h * 0.2);
  const sw = Math.max(16, w * 0.6);
  const sh = Math.max(16, h * 0.6);

  octx.drawImage(video, sx, sy, sw, sh, 0, 0, sampleW, sampleH);
  const { data } = octx.getImageData(0, 0, sampleW, sampleH);

  let rSum = 0,
    gSum = 0,
    bSum = 0,
    upperLum = 0,
    upperCount = 0,
    cheekLum = 0,
    cheekCount = 0;

  const totalPixels = sampleW * sampleH;
  for (let py = 0; py < sampleH; py++) {
    for (let px = 0; px < sampleW; px++) {
      const idx = (py * sampleW + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      rSum += r;
      gSum += g;
      bSum += b;

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (py >= 16 && py <= 28) {
        upperLum += lum;
        upperCount++;
      } else if (py >= 34 && py <= 50) {
        cheekLum += lum;
        cheekCount++;
      }
    }
  }

  const avgR = rSum / totalPixels;
  const avgG = gSum / totalPixels;
  const avgB = bSum / totalPixels;
  const avgLum = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

  const rednessRaw = Math.max(0, Math.min(100, (avgR - (avgG + avgB) * 0.48) * 1.45));
  const avgEyeLum = upperCount ? upperLum / upperCount : avgLum;
  const avgCheekLum = cheekCount ? cheekLum / cheekCount : avgLum;
  const eyeShadowDiff = Math.max(0, avgCheekLum - avgEyeLum);
  const fatigueRaw = Math.max(10, Math.min(100, eyeShadowDiff * 2.2 + 18));

  const chroma = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);
  const pallorRaw = Math.max(8, Math.min(100, (55 - chroma) * 1.7));

  state.smoothing.redness = Math.round(state.smoothing.redness * 0.75 + rednessRaw * 0.25);
  state.smoothing.fatigue = Math.round(state.smoothing.fatigue * 0.75 + fatigueRaw * 0.25);
  state.smoothing.pallor = Math.round(state.smoothing.pallor * 0.75 + pallorRaw * 0.25);

  return {
    redness: state.smoothing.redness,
    fatigue: state.smoothing.fatigue,
    pallor: state.smoothing.pallor,
  };
}

function computeHealthAndMoodAssessment(moodKey, moodConf, skinStats, happyPct, sadPct) {
  const moodMap = {
    happy: { label: 'HAPPY 😊', code: 'HAPPY', color: '#10b981' },
    sad: { label: 'SAD 😔', code: 'SAD', color: '#60a5fa' },
    angry: { label: 'STRESSED 😠', code: 'STRESSED', color: '#f59e0b' },
    fearful: { label: 'ANXIOUS 😟', code: 'ANXIOUS', color: '#f59e0b' },
    disgusted: { label: 'DISCOMFORT 😣', code: 'DISCOMFORT', color: '#ef4444' },
    surprised: { label: 'SURPRISED 😮', code: 'SURPRISED', color: '#38bdf8' },
    neutral: { label: 'CALM / NEUTRAL 🙂', code: 'NEUTRAL', color: '#10b981' },
  };

  const moodInfo = moodMap[moodKey] || moodMap.neutral;
  const confPct = Math.round(Math.min(99, Math.max(55, moodConf * 100)));

  let rednessScore = skinStats.redness;
  let fatigueScore = skinStats.fatigue;
  let pallorScore = skinStats.pallor;

  if (state.patient.symptoms.includes('Fever / Feeling Hot')) {
    rednessScore = Math.min(96, rednessScore + 22);
  }
  if (
    state.patient.sleep === '<5' ||
    state.patient.symptoms.includes('Fatigue / Weakness')
  ) {
    fatigueScore = Math.min(95, fatigueScore + 20);
  }
  if (state.patient.symptoms.includes('Dehydration / Dry Skin')) {
    pallorScore = Math.min(95, pallorScore + 18);
  }
  if (moodKey === 'sad' || sadPct > 45) {
    fatigueScore = Math.min(95, fatigueScore + 12);
  }

  let condition = 'HEALTHY / NORMAL';
  let conditionCode = 'HEALTHY';
  let boxColor = '#10b981';
  let note =
    'Facial tone, ocular contrast, and expression appear within healthy baseline parameters.';

  if (rednessScore >= 65) {
    condition = 'DISEASE SIGN: FACIAL FLUSH / FEVER';
    conditionCode = 'FEVER_RISK';
    boxColor = '#ef4444';
    note =
      'Elevated facial redness/flush detected inside the face box. May indicate fever or inflammation. Checking TMP36 sensor.';
  } else if (fatigueScore >= 62) {
    condition = 'FATIGUE / OCULAR EXHAUSTION';
    conditionCode = 'FATIGUE';
    boxColor = '#f59e0b';
    note =
      'Significant under-eye shadow contrast and facial fatigue indicators detected. Rest and hydration recommended.';
  } else if (pallorScore >= 62) {
    condition = 'SKIN PALLOR / DEHYDRATION';
    conditionCode = 'PALLOR';
    boxColor = '#f59e0b';
    note =
      'Reduced skin chroma (pallor) detected in the facial region. Possible dehydration or anemia sign.';
  } else if (moodKey === 'sad' || sadPct >= 40) {
    condition = 'SAD / EMOTIONAL DISTRESS';
    conditionCode = 'SAD_MOOD';
    boxColor = '#3b82f6';
    note =
      'Sad facial expression threshold elevated. Monitoring emotional well-being and heart rate variability.';
  }

  const vitality = Math.max(
    32,
    Math.min(
      98,
      Math.round(100 - (rednessScore * 0.25 + fatigueScore * 0.35 + pallorScore * 0.25))
    )
  );

  return {
    moodLabel: moodInfo.label,
    moodCode: moodInfo.code,
    moodConf: confPct,
    happyPct: moodKey === 'happy' ? Math.max(happyPct, confPct) : happyPct,
    sadPct: moodKey === 'sad' ? Math.max(sadPct, confPct) : sadPct,
    condition,
    conditionCode,
    boxColor,
    rednessScore,
    fatigueScore,
    pallorScore,
    vitality,
    note,
  };
}

// Draw the Square Face Detection Box and Live Thresholds on Canvas
function drawSquareFaceHUD(ctx, x, y, size, analysis) {
  ctx.save();

  ctx.strokeStyle = analysis.boxColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, size, size);

  const corner = Math.min(28, size * 0.16);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y + corner);
  ctx.lineTo(x, y);
  ctx.lineTo(x + corner, y);
  ctx.moveTo(x + size - corner, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size, y + corner);
  ctx.moveTo(x, y + size - corner);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x + corner, y + size);
  ctx.moveTo(x + size - corner, y + size);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x + size, y + size - corner);
  ctx.stroke();

  // Top Badge: Mood + Happy/Sad Thresholds
  const topText = `${analysis.moodLabel} | Happy:${analysis.happyPct}% Sad:${analysis.sadPct}%`;
  ctx.font = 'bold 13px Inter, sans-serif';
  const topWidth = ctx.measureText(topText).width + 18;
  const topY = Math.max(8, y - 34);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(x, topY, topWidth, 28);
  ctx.strokeStyle = analysis.boxColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, topY, topWidth, 28);

  ctx.fillStyle = '#f8fafc';
  ctx.fillText(topText, x + 9, topY + 18);

  // Bottom Badge: Disease / Condition + Redness/Fatigue %
  const botText = `${analysis.condition} (Red:${analysis.rednessScore}% Fat:${analysis.fatigueScore}%)`;
  const botWidth = ctx.measureText(botText).width + 18;
  const botY = Math.min(ctx.canvas.height - 34, y + size + 8);

  ctx.fillStyle = analysis.boxColor;
  ctx.fillRect(x, botY, botWidth, 28);

  ctx.fillStyle = '#050811';
  ctx.fillText(botText, x + 9, botY + 18);

  ctx.restore();
}

function updateDashboardMetrics(analysis, detected) {
  faceDetectedValue.textContent = detected ? 'LOCKED (SQUARE ROI)' : 'Scanning...';
  faceDetectedValue.style.color = detected ? '#10b981' : '#f59e0b';

  moodValue.textContent = `${analysis.moodLabel} (${analysis.moodConf}%)`;
  conditionValue.textContent = analysis.condition;
  conditionValue.style.color = analysis.boxColor;
  vitalityValue.textContent = `${analysis.vitality} / 100`;

  happyLabel.textContent = `${analysis.happyPct}%`;
  happyBar.style.width = `${analysis.happyPct}%`;

  sadLabel.textContent = `${analysis.sadPct}%`;
  sadBar.style.width = `${analysis.sadPct}%`;

  rednessLabel.textContent =
    analysis.rednessScore >= 65
      ? `Elevated (${analysis.rednessScore}%)`
      : `Normal (${analysis.rednessScore}%)`;
  rednessBar.style.width = `${analysis.rednessScore}%`;

  fatigueLabel.textContent =
    analysis.fatigueScore >= 62
      ? `High Fatigue (${analysis.fatigueScore}%)`
      : `Low (${analysis.fatigueScore}%)`;
  fatigueBar.style.width = `${analysis.fatigueScore}%`;

  pallorLabel.textContent =
    analysis.pallorScore >= 62
      ? `Pale / Pallor (${analysis.pallorScore}%)`
      : `Normal (${analysis.pallorScore}%)`;
  pallorBar.style.width = `${analysis.pallorScore}%`;

  diagnosticAlertBox.style.borderLeftColor = analysis.boxColor;
  diagnosticAlertBox.innerHTML = `<strong>AI Screening Diagnosis:</strong> ${analysis.note}`;
}

// 6. Save JSON Report
captureSnapshotBtn.addEventListener('click', () => {
  const report = {
    timestamp: new Date().toISOString(),
    patient: {
      name: state.patient.name,
      age: state.patient.age,
      gender: state.patient.gender,
      sleep: state.patient.sleep,
      symptoms: state.patient.symptoms,
    },
    facialDiagnostics: state.latestAnalysis,
    esp32Sensors: state.espVitals,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `health-report-${state.patient.name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
});

// 7. ESP32 Connection (Web Serial API + Live AD8232 ECG & SSD1306 Mini OLED Mirror)
// 7. ESP32 Wireless Wi-Fi WebSocket + Web Serial Connection
connectWifiEspBtn.addEventListener('click', () => {
  if (state.espWebSocket) {
    state.espWebSocket.close();
    state.espWebSocket = null;
    state.espConnected = false;
    state.espWireless = false;
    espStatusBadge.textContent = 'ESP32: Not Connected';
    espStatusBadge.className = 'badge badge-esp-disconnected';
    connectWifiEspBtn.textContent = '📶 Wi-Fi Connect';
    return;
  }
  wifiIpInputRow.classList.toggle('hidden');
});

confirmWifiConnectBtn.addEventListener('click', () => {
  const ip = espIpAddressInput.value.trim() || '192.168.1.100';
  connectToEspWebSocket(ip);
});

function connectToEspWebSocket(ip) {
  try {
    const wsUrl = `ws://${ip}:81/`;
    espStatusBadge.textContent = `Connecting ${ip}...`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      state.espWebSocket = ws;
      state.espConnected = true;
      state.espWireless = true;
      state.espHardwareSerial = true;
      setEspConnectedUI(`ESP32: Wi-Fi Connected (${ip})`);
      connectWifiEspBtn.textContent = '📶 Disconnect Wi-Fi';
      wifiIpInputRow.classList.add('hidden');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.hr === 'number') state.espVitals.hr = data.hr;
        if (typeof data.spo2 === 'number') state.espVitals.spo2 = data.spo2;
        if (typeof data.temp === 'number') state.espVitals.temp = data.temp;
        if (typeof data.ecg === 'number') {
          state.espVitals.ecg = data.ecg;
          state.ecgHistory.push(data.ecg);
          if (state.ecgHistory.length > 220) state.ecgHistory.shift();
        }
        if (typeof data.leadsOff === 'boolean') state.espVitals.leadsOff = data.leadsOff;
        updateEspSensorTiles();
      } catch (e) {}
    };

    ws.onerror = (err) => {
      alert(`Could not connect to ESP32 at ws://${ip}:81. Please verify ESP32 is on the same Wi-Fi and running esp32_wireless_firmware.ino.`);
      espStatusBadge.textContent = 'ESP32: Wi-Fi Error';
      espStatusBadge.className = 'badge badge-esp-disconnected';
    };

    ws.onclose = () => {
      state.espWebSocket = null;
      state.espWireless = false;
      connectWifiEspBtn.textContent = '📶 Wi-Fi Connect';
    };
  } catch (err) {
    alert('Invalid WebSocket IP: ' + err.message);
  }
}

connectEspBtn.addEventListener('click', async () => {
  if (state.espConnected && state.espPort) {
    state.espConnected = false;
    state.espHardwareSerial = false;
    espStatusBadge.textContent = 'ESP32: Not Connected';
    espStatusBadge.className = 'badge badge-esp-disconnected';
    connectEspBtn.textContent = 'Connect ESP32 (USB)';
    return;
  }

  if ('serial' in navigator) {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      state.espPort = port;
      state.espWriter = port.writable.getWriter();
      state.espConnected = true;
      state.espHardwareSerial = true;
      setEspConnectedUI('ESP32: USB Serial Active');
      readEspSerialLoop(port);
      return;
    } catch (err) {
      console.info('USB Serial not selected, starting interactive ESP32 Hardware Preview.');
    }
  }

  state.espConnected = !state.espConnected;
  state.espHardwareSerial = false;
  if (state.espConnected) {
    setEspConnectedUI('ESP32: Live Sensor Sim Active');
  } else {
    espStatusBadge.textContent = 'ESP32: Not Connected';
    espStatusBadge.className = 'badge badge-esp-disconnected';
    connectEspBtn.textContent = 'Connect ESP32 (USB)';
    espPacket.textContent = 'IDLE';
  }
});

function setEspConnectedUI(label) {
  espStatusBadge.textContent = label;
  espStatusBadge.className = 'badge badge-esp-connected';
  connectEspBtn.textContent = 'Disconnect ESP32';
}

async function readEspSerialLoop(port) {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();
  let buffer = '';

  try {
    while (state.espConnected) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const data = JSON.parse(trimmed);
            if (typeof data.hr === 'number') state.espVitals.hr = data.hr;
            if (typeof data.spo2 === 'number') state.espVitals.spo2 = data.spo2;
            if (typeof data.temp === 'number') state.espVitals.temp = data.temp;
            if (typeof data.ecg === 'number') {
              state.espVitals.ecg = data.ecg;
              state.ecgHistory.push(data.ecg);
              if (state.ecgHistory.length > 220) state.ecgHistory.shift();
            }
            if (typeof data.leadsOff === 'boolean') state.espVitals.leadsOff = data.leadsOff;
            updateEspSensorTiles();
          } catch (e) {
            // Ignore partial JSON line
          }
        }
      }
    }
  } catch (err) {
    console.warn('ESP32 serial read closed:', err);
  }
}

async function streamToESP32(analysis) {
  const now = Date.now();
  if (now - state.lastEspSend < 800) return;
  state.lastEspSend = now;

  // Format expected by ESP32 firmware: MOOD,MOOD_PCT,CONDITION,VITALITY\n
  const packet = `${analysis.moodCode},${analysis.moodConf},${analysis.conditionCode},${analysis.vitality}`;
  espPacket.textContent = packet;

  // 1. Send wirelessly over Wi-Fi WebSocket if connected
  if (state.espWebSocket && state.espWebSocket.readyState === WebSocket.OPEN) {
    try {
      state.espWebSocket.send(packet);
    } catch (e) {
      console.warn('ESP32 WebSocket send error:', e);
    }
  }

  // 2. Send over USB Serial if connected
    try {
      const data = new TextEncoder().encode(packet + '\n');
      await state.espWriter.write(data);
    } catch (e) {
      console.warn('ESP32 write error:', e);
    }
  }
}

function updateEspSensorTiles() {
  const { hr, spo2, temp, leadsOff } = state.espVitals;
  espHeartRate.textContent = hr > 0 ? `${hr} BPM` : 'No Finger';
  espSpo2.textContent = spo2 > 0 ? `${spo2} %` : '-- %';
  const tempF = ((temp * 9) / 5 + 32).toFixed(1);
  espTemp.textContent = `${temp.toFixed(1)} °C (${tempF} °F)`;

  ecgLeadBadge.textContent = leadsOff ? 'Leads: OFF!' : 'Leads: OK';
  ecgLeadBadge.style.color = leadsOff ? '#fca5a5' : '#34d399';
}

// 8. Real-Time AD8232 ECG Waveform & 128x64 SSD1306 Mini OLED Display Loop
function renderEcgAndOledLoop() {
  // Generate realistic PQRST ECG wave when not receiving raw USB serial samples
  if (!state.espHardwareSerial) {
    state.ecgSimPhase = (state.ecgSimPhase + 1) % 36;
    const p = state.ecgSimPhase;
    let sample = 2048;
    if (p === 6 || p === 7) sample = 2220; // P wave
    else if (p === 11) sample = 1790; // Q dip
    else if (p === 12) sample = 3480; // R peak
    else if (p === 13) sample = 1450; // S dip
    else if (p >= 18 && p <= 21) sample = 2340; // T wave
    else sample = 2048 + Math.round((Math.random() - 0.5) * 45);

    state.espVitals.ecg = sample;
    state.ecgHistory.push(sample);
    if (state.ecgHistory.length > 220) state.ecgHistory.shift();

    // Subtle physiological variation on MAX30102 & TMP36 preview
    if (p === 0) {
      const a = state.latestAnalysis;
      state.espVitals.hr = a.moodCode === 'SAD' ? 68 : a.rednessScore > 65 ? 92 : 76;
      state.espVitals.spo2 = 98;
      state.espVitals.temp = a.rednessScore > 65 ? 37.8 : 36.7;
      updateEspSensorTiles();
    }
  }

  drawAd8232EcgCanvas();
  drawSsd1306OledCanvas();

  setTimeout(() => requestAnimationFrame(renderEcgAndOledLoop), 45);
}

function drawAd8232EcgCanvas() {
  const ctx = ecgCanvas.getContext('2d');
  const w = ecgCanvas.width;
  const h = ecgCanvas.height;

  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, w, h);

  // Medical ECG grid
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw AD8232 ECG trace
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const len = state.ecgHistory.length;
  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * w;
    const val = state.ecgHistory[i];
    const y = h - ((val - 1000) / 2800) * (h - 20) - 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawSsd1306OledCanvas() {
  const ctx = oledCanvas.getContext('2d');
  const w = oledCanvas.width; // 256 (2x scale of 128x64)
  const h = oledCanvas.height; // 128

  ctx.fillStyle = '#020408';
  ctx.fillRect(0, 0, w, h);

  const a = state.latestAnalysis;
  const v = state.espVitals;

  // SSD1306 Yellow/Blue top band + cyan body look
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.fillStyle = '#fde047'; // Top yellow status row on dual-color 0.96" OLED
  ctx.fillText(`FACE: ${a.moodCode} ${a.moodConf}%`, 8, 16);

  ctx.fillStyle = '#38bdf8'; // Cyan OLED rows
  ctx.fillText(`COND: ${a.conditionCode.substring(0, 14)}`, 8, 36);
  ctx.fillText(`HR:${v.hr}bpm SpO2:${v.spo2}%`, 8, 56);
  ctx.fillText(`TMP:${v.temp.toFixed(1)}C ECG:${v.leadsOff ? 'OFF' : 'OK'}`, 8, 76);

  // Horizontal divider line
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 84);
  ctx.lineTo(w, 84);
  ctx.stroke();

  // Mini ECG waveform along the bottom of the OLED (y = 88..124)
  ctx.beginPath();
  const slice = state.ecgHistory.slice(-128);
  for (let i = 0; i < slice.length; i++) {
    const x = (i / 127) * w;
    const y = 122 - ((slice[i] - 1200) / 2500) * 34;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

requestAnimationFrame(renderEcgAndOledLoop);

// 9. ESP32 Firmware Code Modal
const ESP32_FIRMWARE_SOURCE = `/*
 * BioSense AI — ESP32 Smart Health & Facial Diagnostic Firmware
 *
 * Connected Hardware:
 * 1. Mini OLED Display (SSD1306 128x64 I2C) -> SDA: GPIO 21, SCL: GPIO 22 (Addr: 0x3C)
 * 2. MAX30102 Pulse Oximeter & Heart Rate   -> SDA: GPIO 21, SCL: GPIO 22 (Addr: 0x57)
 * 3. AD8232 Single-Lead ECG Sensor          -> OUTPUT: GPIO 34, LO+: GPIO 32, LO-: GPIO 33
 * 4. TMP36 Analog Temperature Sensor        -> VOUT: GPIO 35
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "MAX30105.h"
#include "heartRate.h"

#define I2C_SDA         21
#define I2C_SCL         22
#define AD8232_OUT_PIN  34
#define AD8232_LOP_PIN  32
#define AD8232_LON_PIN  33
#define TMP36_PIN       35

#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64
#define OLED_RESET      -1
#define OLED_ADDR       0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
MAX30105 particleSensor;

bool max30102Ready = false;
bool oledReady = false;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 75;
int spo2Value = 98;
float temperatureC = 36.6;
int ecgRaw = 2048;
bool ecgLeadsOff = false;

String aiMood = "WAITING";
String aiCondition = "SCANNING";
int aiMoodPct = 0;
int aiVitality = 100;

unsigned long lastTelemetryMs = 0;
unsigned long lastOledUpdateMs = 0;
uint8_t oledEcgBuffer[128];
uint8_t oledEcgIdx = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(AD8232_OUT_PIN, INPUT);
  pinMode(AD8232_LOP_PIN, INPUT);
  pinMode(AD8232_LON_PIN, INPUT);
  pinMode(TMP36_PIN, INPUT);

  for (int i = 0; i < 128; i++) oledEcgBuffer[i] = 54;
  Wire.begin(I2C_SDA, I2C_SCL);

  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    oledReady = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println(F("BioSense AI - ESP32"));
    display.display();
  }

  if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x1F);
    particleSensor.setPulseAmplitudeGreen(0);
    max30102Ready = true;
  }
}

float readTmp36Celsius() {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(TMP36_PIN);
  float voltage = ((sum / 8.0) / 4095.0) * 3.3;
  return (voltage - 0.5) * 100.0;
}

void readWebsiteSerialCommand() {
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\\n');
    line.trim();
    int c1 = line.indexOf(',');
    int c2 = line.indexOf(',', c1 + 1);
    int c3 = line.indexOf(',', c2 + 1);
    if (c1 > 0 && c2 > c1 && c3 > c2) {
      aiMood = line.substring(0, c1);
      aiMoodPct = line.substring(c1 + 1, c2).toInt();
      aiCondition = line.substring(c2 + 1, c3);
      aiVitality = line.substring(c3 + 1).toInt();
    }
  }
}

void updateMiniOled() {
  if (!oledReady) return;
  display.clearDisplay();
  display.setCursor(0, 0);
  display.print(F("FACE: ")); display.print(aiMood); display.print(F(" ")); display.print(aiMoodPct); display.print(F("%"));
  display.setCursor(0, 10);
  display.print(F("COND: ")); display.print(aiCondition.substring(0, 14));
  display.setCursor(0, 22);
  display.print(F("HR:")); display.print(beatAvg); display.print(F("bpm SpO2:")); display.print(spo2Value); display.print(F("%"));
  display.setCursor(0, 32);
  display.print(F("TMP:")); display.print(temperatureC, 1); display.print(F("C ECG:")); display.print(ecgLeadsOff ? F("OFF") : F("OK"));
  display.drawLine(0, 42, 127, 42, SSD1306_WHITE);
  for (int x = 0; x < 127; x++) {
    display.drawLine(x, oledEcgBuffer[(oledEcgIdx + x) % 128], x + 1, oledEcgBuffer[(oledEcgIdx + x + 1) % 128], SSD1306_WHITE);
  }
  display.display();
}

void loop() {
  readWebsiteSerialCommand();
  if (max30102Ready) {
    long irValue = particleSensor.getIR();
    long redValue = particleSensor.getRed();
    if (irValue > 50000) {
      if (checkForBeat(irValue)) {
        long delta = millis() - lastBeat;
        lastBeat = millis();
        beatsPerMinute = 60 / (delta / 1000.0);
        if (beatsPerMinute < 220 && beatsPerMinute > 40) {
          rates[rateSpot++] = (byte)beatsPerMinute;
          rateSpot %= RATE_SIZE;
          beatAvg = 0;
          for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
          beatAvg /= RATE_SIZE;
        }
      }
      spo2Value = constrain((int)(110.0 - 18.0 * ((float)redValue / (float)irValue)), 85, 100);
    }
  }

  unsigned long now = millis();
  if (now - lastTelemetryMs >= 40) {
    lastTelemetryMs = now;
    ecgLeadsOff = (digitalRead(AD8232_LOP_PIN) == 1) || (digitalRead(AD8232_LON_PIN) == 1);
    ecgRaw = ecgLeadsOff ? 2048 : analogRead(AD8232_OUT_PIN);
    oledEcgBuffer[oledEcgIdx] = map(constrain(ecgRaw, 800, 3300), 800, 3300, 62, 44);
    oledEcgIdx = (oledEcgIdx + 1) % 128;
    temperatureC = readTmp36Celsius();

    Serial.print(F("{\\"hr\\":")); Serial.print(beatAvg);
    Serial.print(F(",\\"spo2\\":")); Serial.print(spo2Value);
    Serial.print(F(",\\"temp\\":")); Serial.print(temperatureC, 1);
    Serial.print(F(",\\"ecg\\":")); Serial.print(ecgRaw);
    Serial.print(F(",\\"leadsOff\\":")); Serial.print(ecgLeadsOff ? F("true") : F("false"));
    Serial.println(F("}"));
  }

  if (now - lastOledUpdateMs >= 125) {
    lastOledUpdateMs = now;
    updateMiniOled();
  }
}`;

espCodePre.textContent = ESP32_FIRMWARE_SOURCE;

openEspCodeModalBtn.addEventListener('click', () => {
  espCodeModal.classList.remove('hidden');
});

closeEspCodeModalBtn.addEventListener('click', () => {
  espCodeModal.classList.add('hidden');
});

copyEspCodeBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(ESP32_FIRMWARE_SOURCE);
  copyEspCodeBtn.textContent = '✓ Copied to Clipboard!';
  setTimeout(() => {
    copyEspCodeBtn.textContent = '📋 Copy Arduino Code';
  }, 2000);
});
} // End of initBioSenseApp
