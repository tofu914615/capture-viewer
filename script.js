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

    // 時間領域（波形）のデータを取得する配列に変更
    const dataArray = new Uint8Array(analyser.fftSize);

    function updateMeter() {
        if (isMuted) {
            volumeSlider.style.setProperty('--meter-level', '0%');
        } else {
            // 周波数ではなく、波形データを取得
            analyser.getByteTimeDomainData(dataArray);
            
            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
                // 128を中心に波形が振れるため、-1.0 〜 1.0 の範囲に正規化
                let norm = (dataArray[i] / 128.0) - 1.0;
                sumSquares += norm * norm;
            }
            
            // 二乗平均平方根（RMS）を計算して全体的な音量を算出
            let rms = Math.sqrt(sumSquares / dataArray.length);
            
            // 感度調整（数値が大きいほどメーターが右に振れやすくなる）
            const sensitivity = 300; 
            
            let level = Math.min(100, Math.round(rms * sensitivity));
            
            // 足切り（しきい値）：計算結果が5%以下の微細なノイズは0%にする
            if (level < 5) {
                level = 0;
            }

            volumeSlider.style.setProperty('--meter-level', level + '%');
        }
        animationId = requestAnimationFrame(updateMeter);
    }

    updateMeter();
}
