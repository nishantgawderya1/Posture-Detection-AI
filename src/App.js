// ✅ Rewritten App.js with safer posture detection logic
import './App.css';
import React, { useRef, useEffect, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import * as cam from '@mediapipe/camera_utils';
import * as mediapipePose from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import Webcam from 'react-webcam';
import { Menu, btnSelected, setBtn } from './components/Menu';
import { LoadingScreen } from './components/LoadingScreen';
import {
  changeStyleProperty,
  badPosture,
  showNotification,
  speakFeedback,
  drawLine,
  drawCircle,
  shouldersLevel,
  backStraight
} from './utils/utilities';

function App() {
  const canvasRef = useRef(null);
  const webcamRef = useRef(null);
  const postureRef = useRef(null);
  const goodPostureRef = useRef(null);

  const [loaded, setLoaded] = useState(false);
  const [lastAudioFeedbackTime, setLastAudioFeedbackTime] = useState(0);
  const [postureFeedback, setPostureFeedback] = useState('');
  const audioFeedbackInterval = 30000;
  let badPostureCount = 0;

  function getPostureFeedback(landmarks, goodPosture) {
    if (!landmarks || !goodPosture) return "Analyzing posture...";
    let feedback = [];

    const headYDiff = landmarks[0].y - goodPosture[0].y;
    if (headYDiff > 0.03) feedback.push("Lift your head slightly");
    else if (headYDiff < -0.03) feedback.push("Lower your head slightly");

    const shoulderYDiff = Math.abs(landmarks[11].y - landmarks[12].y);
    if (shoulderYDiff > 0.02) {
      feedback.push(landmarks[11].y > landmarks[12].y ?
        "Raise your left shoulder" : "Raise your right shoulder");
    }

    const midShoulder = {
      x: (landmarks[11].x + landmarks[12].x) / 2,
      y: (landmarks[11].y + landmarks[12].y) / 2
    };
    const midHip = {
      x: (landmarks[23].x + landmarks[24].x) / 2,
      y: (landmarks[23].y + landmarks[24].y) / 2
    };
    const midKnee = {
      x: (landmarks[25].x + landmarks[26].x) / 2,
      y: (landmarks[25].y + landmarks[26].y) / 2
    };

    const backAngle = Math.atan2(midHip.y - midShoulder.y, midHip.x - midShoulder.x);
    const goodBackAngle = Math.atan2(
      (goodPosture[23].y + goodPosture[24].y) / 2 - (goodPosture[11].y + goodPosture[12].y) / 2,
      (goodPosture[23].x + goodPosture[24].x) / 2 - (goodPosture[11].x + goodPosture[12].x) / 2
    );
    if (Math.abs(backAngle - goodBackAngle) > 0.1) feedback.push("Adjust your back posture");

    const neckLength = Math.hypot(landmarks[0].x - midShoulder.x, landmarks[0].y - midShoulder.y);
    const goodNeckLength = Math.hypot(
      goodPosture[0].x - ((goodPosture[11].x + goodPosture[12].x) / 2),
      goodPosture[0].y - ((goodPosture[11].y + goodPosture[12].y) / 2)
    );
    if (neckLength < goodNeckLength * 0.95) feedback.push("Stretch your neck and relax shoulders");

    return feedback.length ? feedback.join(". ") : "Great posture! Keep it up!";
  }

  function onResults(results) {
    if (!loaded) {
      setLoaded(true);
      changeStyleProperty("--loader-display", "none");
    }

    if (!canvasRef.current || !webcamRef.current || !webcamRef.current.video) return;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");

    canvasElement.width = webcamRef.current.video.videoWidth;
    canvasElement.height = webcamRef.current.video.videoHeight;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (!results.poseLandmarks) return;
    drawConnectors(canvasCtx, results.poseLandmarks, mediapipePose.POSE_CONNECTIONS, { color: '#fff', lineWidth: 4 });
    drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#fff', lineWidth: 2 });

    if (btnSelected) {
      goodPostureRef.current = results.poseLandmarks;
      console.log("Calibration complete");
      setBtn(false);
    }

    if (!goodPostureRef.current) return;

    const feedback = getPostureFeedback(results.poseLandmarks, goodPostureRef.current);
    setPostureFeedback(feedback);

    const status = feedback.includes("Great posture") ? 'GOOD' : 'NEEDS IMPROVEMENT';
    changeStyleProperty('--posture-status', `'${status}'`);

    if (status !== 'GOOD') {
      badPostureCount++;
      if (badPostureCount >= 60) {
        showNotification("Posture needs attention!");
        const now = Date.now();
        if (now - lastAudioFeedbackTime > audioFeedbackInterval) {
          speakFeedback(feedback);
          setLastAudioFeedbackTime(now);
        }
        badPostureCount = 0;
      }
    } else {
      badPostureCount = 0;
    }
  }

  useEffect(() => {
    const pose = new Pose({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    pose.onResults(onResults);

    const wait = setInterval(() => {
      if (webcamRef.current?.video?.readyState === 4) {
        clearInterval(wait);
        const camera = new cam.Camera(webcamRef.current.video, {
          onFrame: async () => await pose.send({ image: webcamRef.current.video }),
          width: 640,
          height: 480
        });
        camera.start();
      }
    }, 500);

    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {!loaded && <LoadingScreen />}
      <div className={`flex-grow App bg-gradient-to-br from-deep-space to-space-gray flex flex-col items-center justify-center p-4 sm:p-8 ${!loaded ? 'hidden' : ''}`}>
        <div className="w-full max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-center space-y-8 xl:space-y-0 xl:space-x-8">
          <Menu postureRef={postureRef} />
          <div className="display relative rounded-3xl overflow-hidden w-full max-w-lg xl:max-w-xl bg-deep-space">
            <div className="absolute inset-0 bg-gradient-to-r from-neon-blue to-neon-green opacity-5 z-10"></div>
            <Webcam ref={webcamRef} className="webcam rounded-3xl w-full opacity-90" width="100%" height="auto" />
            <canvas ref={canvasRef} className="canvas absolute top-0 left-0 rounded-3xl w-full h-full z-20" />
            <div className="absolute top-4 left-4 bg-deep-space bg-opacity-70 text-neon-blue px-3 py-1 rounded-full text-sm font-medium z-30 backdrop-filter backdrop-blur-sm">Live Feed</div>
            {postureFeedback && (
              <div className="absolute bottom-4 left-4 right-4 bg-deep-space bg-opacity-70 text-neon-green px-3 py-2 rounded-lg text-sm font-medium z-30 backdrop-filter backdrop-blur-sm">
                {postureFeedback}
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="bg-deep-space text-neon-blue py-2 text-center">
        <p className="text-sm">made with 💌 by Nishant</p>
      </footer>
    </div>
  );
}

export default App;
