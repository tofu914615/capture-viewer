const videoElement = document.getElementById('v');
const videoSelect = document.getElementById('video-source');
const audioSelect = document.getElementById('audio-source');
const resolutionSelect = document.getElementById('resolution');
const volumeSlider = document.getElementById('volume-slider');
const muteBtn = document.getElementById('mute-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');

let currentStream;
let isMuted = false;

let audioContext;
let analyser;
let microphone;
let animationId;

function loadSettings() {
    const savedVideo = localStorage.getItem('capture_video');
    const savedAudio = localStorage.getItem('capture_audio');
    const savedResolution = localStorage.getItem('capture_resolution');
    const savedVolume = localStorage.getItem('capture_volume');

    if (savedVideo) videoSelect.value = savedVideo;
    if (savedAudio) audioSelect.value = savedAudio;
    if (savedResolution) resolutionSelect.value = savedResolution;
    if (savedVolume !== null) {
        volumeSlider.value = savedVolume;
        videoElement.volume = parseFloat(savedVolume);
    }
}

function saveSettings() {
    localStorage.setItem('capture_video', videoSelect.value);
    localStorage.setItem('capture_audio', audioSelect.value);
    localStorage.setItem('capture_resolution', resolutionSelect.value);
}

async function getDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        videoSelect.innerHTML = '';
        audioSelect.innerHTML = '';

        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            
            let cleanLabel = device.label || '';
            cleanLabel = cleanLabel.replace(/\s*\([a-zA-Z0-9:]+\)$/, '');

            if (device.kind === 'videoinput') {
                option.text = cleanLabel || `カメラ ${videoSelect.length + 1}`;
                videoSelect.appendChild(option);
            } else if (device.kind === 'audioinput') {
                option.text = cleanLabel || `マイク ${audioSelect.length + 1}`;
                audioSelect.appendChild(option);
            }
        });

        loadSettings();

    } catch (error) {
        console.error('デバイスの取得エラー:', error);
        alert('カメラ・マイクへのアクセスが許可されていないか、デバイスが見つかりません。');
    }
}

function startAudioMeter(stream) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    if (analyser) analyser.disconnect();
    if (microphone) microphone.disconnect();
    if (animationId) cancelAnimationFrame(animationId);

    if (stream.getAudioTracks().length === 0) return;

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);

    function updateMeter() {
        if (isMuted) {
            volumeSlider.style.setProperty('--meter-level', '0%');
        } else {
            analyser.getByteTimeDomainData(dataArray);
            
            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
                let norm = (dataArray[i] / 128.0) - 1.0;
                sumSquares += norm * norm;
            }
            
            let rms = Math.sqrt(sumSquares / dataArray.length);
            const sensitivity = 250; 
            let level = Math.min(100, Math.round(rms * sensitivity));
            
            if (level < 10) {
                level = 0;
            }

            volumeSlider.style.setProperty('--meter-level', level + '%');
        }
        animationId = requestAnimationFrame(updateMeter);
    }

    updateMeter();
}

async function startStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    saveSettings(); 

    const videoSource = videoSelect.value;
    const audioSource = audioSelect.value;
    const [width, height] = resolutionSelect.value.split('x').map(Number);

    const constraints = {
        video: {
            deviceId: videoSource ? { exact: videoSource } : undefined,
            width: { ideal: width },
            height: { ideal: height },
            aspectRatio: { ideal: width / height }
        },
        audio: {
            deviceId: audioSource ? { exact: audioSource } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        }
    };

    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = currentStream;
        
        videoElement.style.aspectRatio = `${width} / ${height}`;
        videoElement.style.objectFit = 'cover';
        
        const audioTracks = currentStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = !isMuted;
        }

        startAudioMeter(currentStream);

    } catch (error) {
        console.error('ストリーム開始エラー:', error);
        alert('選択した設定で映像を取得できませんでした。');
    }
}

volumeSlider.addEventListener('input', (e) => {
    const vol = e.target.value;
    videoElement.volume = parseFloat(vol);
    localStorage.setItem('capture_volume', vol);
});

muteBtn.addEventListener('click', () => {
    if (!currentStream) return;
    
    const audioTracks = currentStream.getAudioTracks();
    if (audioTracks.length > 0) {
        isMuted = !isMuted;
        audioTracks[0].enabled = !isMuted;
        
        if (isMuted) {
            muteBtn.textContent = '音声をオンにする';
            muteBtn.classList.add('muted');
            volumeSlider.disabled = true;
        } else {
            muteBtn.textContent = '音声をオフにする';
            muteBtn.classList.remove('muted');
            volumeSlider.disabled = false;
        }
    }
});

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        videoElement.requestFullscreen().catch(err => {
            alert(`全画面表示エラー: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
});

const resumeAudio = () => { if(audioContext && audioContext.state === 'suspended') audioContext.resume(); };

videoSelect.addEventListener('change', () => { resumeAudio(); startStream(); });
audioSelect.addEventListener('change', () => { resumeAudio(); startStream(); });
resolutionSelect.addEventListener('change', () => { resumeAudio(); startStream(); });

getDevices().then(startStream);
