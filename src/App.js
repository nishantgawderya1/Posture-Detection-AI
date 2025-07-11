import './App.css';
import React, {useRef, useEffect, useState} from 'react';
import {Pose} from '@mediapipe/pose';
import * as cam from '@mediapipe/camera_utils';
import * as mediapipePose from '@mediapipe/pose';
import {drawConnectors, drawLandmarks} from '@mediapipe/drawing_utils'
import Webcam from 'react-webcam';
import {Menu, btnSelected, setBtn} from './components/Menu';
import {LoadingScreen} from './components/LoadingScreen';
import {
  changeStyleProperty,
  badPosture,
  showNotification,
  speakFeedback,
  drawLine,
  drawCircle,
  shouldersLevel,
  backStraight
} from './utils/utilities'

function App() {
  //reference to canvas & webcam
  const canvasRef = useRef(null);
  const webcamRef = useRef(null);

  //reference to the current posture
  const postureRef = useRef(null); //value of 1 is bad, 0 is good, -1 is undetected
  
  let goodPosture = null; 
  const [loaded, setLoaded] = useState(false);
  let badPostureCount = 0; //variable keeps track of the # of frames the user has bad posture

  const [lastAudioFeedbackTime, setLastAudioFeedbackTime] = useState(0);
  const audioFeedbackInterval = 30000; // 30 seconds

  const [postureFeedback, setPostureFeedback] = useState('');

  function getPostureFeedback(landmarks, goodPosture) {
    let feedback = [];

    // Check head position
    const headYDiff = landmarks[0].y - goodPosture[0].y;
    if (headYDiff > 0.03) {
      feedback.push("Lift your head slightly");
    } else if (headYDiff < -0.03) {
      feedback.push("Lower your head slightly");
    }

    // Check shoulders
    const shoulderYDiff = Math.abs(landmarks[11].y - landmarks[12].y);
    if (shoulderYDiff > 0.02) {
      if (landmarks[11].y > landmarks[12].y) {
        feedback.push("Level your shoulders by raising your left shoulder");
      } else {
        feedback.push("Level your shoulders by raising your right shoulder");
      }
    }

    // Check back straightness
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

    if (Math.abs(backAngle - goodBackAngle) > 0.1) {
      if (backAngle > goodBackAngle) {
        feedback.push("Straighten your back by sitting up more");
      } else {
        feedback.push("Relax your back slightly");
      }
    }

    // Check if leaning too far forward or backward
    const shoulderToHipAngle = Math.atan2(midHip.y - midShoulder.y, midHip.x - midShoulder.x);
    const goodShoulderToHipAngle = Math.atan2(
      (goodPosture[23].y + goodPosture[24].y) / 2 - (goodPosture[11].y + goodPosture[12].y) / 2,
      (goodPosture[23].x + goodPosture[24].x) / 2 - (goodPosture[11].x + goodPosture[12].x) / 2
    );

    if (shoulderToHipAngle - goodShoulderToHipAngle > 0.1) {
      feedback.push("Sit back slightly, you're leaning too far forward");
    } else if (goodShoulderToHipAngle - shoulderToHipAngle > 0.1) {
      feedback.push("Sit up slightly, you're leaning too far backward");
    }

    // Check for hunched shoulders
    const neckLength = Math.hypot(landmarks[0].x - midShoulder.x, landmarks[0].y - midShoulder.y);
    const goodNeckLength = Math.hypot(
      goodPosture[0].x - ((goodPosture[11].x + goodPosture[12].x) / 2),
      goodPosture[0].y - ((goodPosture[11].y + goodPosture[12].y) / 2)
    );
    if (neckLength < goodNeckLength * 0.95) {
      feedback.push("Relax your shoulders and stretch your neck");
    }

    // Provide positive feedback if posture is good
    if (feedback.length === 0) {
      feedback.push("Great posture! Keep it up!");
    }

    return feedback.join(". ");
  }

  //run this function when pose results are determined
  function onResults(results){
    if(!loaded){ 
      setLoaded(true);
      console.log("HPE model finished loading.");
      changeStyleProperty("--loader-display","none");
    }

    if (!results.poseLandmarks) { //if the model is unable to detect a pose 
      console.log("No pose detected.");
      postureRef.current = -1;//change pose state to "undetected", can't track pose
      changeStyleProperty("--btn-color","rgba(0, 105, 237, 0.25)"); //fade out the calubrate button by reducing opacity
      return;
    }

    let landmarks = results.poseLandmarks;
    postureRef.current = null;
    changeStyleProperty("--btn-color","rgba(0, 105, 237, 1)"); //make the calibrate button solid

    canvasRef.current.width = webcamRef.current.video.videoWidth
    canvasRef.current.height = webcamRef.current.video.videoHeight

    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");  //canvas context
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    canvasCtx.globalCompositeOperation = 'source-over';
    drawConnectors(canvasCtx, results.poseLandmarks, mediapipePose.POSE_CONNECTIONS,
                   {color: '#fff'/*'#00FF00'*/, lineWidth: 4});
    drawLandmarks(canvasCtx, results.poseLandmarks,
                  {color: '#fff'/*'#FF0000'*/, lineWidth: 2});
    canvasCtx.restore();

    if(goodPosture && results.poseLandmarks){
      const landmarks = results.poseLandmarks;
      const canvasElement = canvasRef.current;
      const canvasCtx = canvasElement.getContext("2d");

      // Draw shoulder level indicator
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const shoulderColor = shouldersLevel(leftShoulder, rightShoulder) ? 'green' : 'red';
      drawLine(canvasCtx, leftShoulder.x * canvasElement.width, leftShoulder.y * canvasElement.height, 
               rightShoulder.x * canvasElement.width, rightShoulder.y * canvasElement.height, shoulderColor, 4);

      // Draw back straightness indicator
      const midShoulder = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2
      };
      const midHip = {
        x: (landmarks[23].x + landmarks[24].x) / 2,
        y: (landmarks[23].y + landmarks[24].y) / 2
      };
      const midKnee = {
        x: (landmarks[25].x + landmarks[26].x) / 2,
        y: (landmarks[25].y + landmarks[26].y) / 2
      };
      const backColor = backStraight(midShoulder, midHip, midKnee) ? 'green' : 'red';
      drawLine(canvasCtx, midShoulder.x * canvasElement.width, midShoulder.y * canvasElement.height,
               midHip.x * canvasElement.width, midHip.y * canvasElement.height, backColor, 4);
      drawLine(canvasCtx, midHip.x * canvasElement.width, midHip.y * canvasElement.height,
               midKnee.x * canvasElement.width, midKnee.y * canvasElement.height, backColor, 4);

      // Draw head position indicator
      const nose = landmarks[0];
      const headColor = nose.y < goodPosture[0].y ? 'green' : 'red';
      drawCircle(canvasCtx, nose.x * canvasElement.width, nose.y * canvasElement.height, 10, headColor);

      // Get and set posture feedback
      const feedback = getPostureFeedback(landmarks, goodPosture);
      setPostureFeedback(feedback);

      // Update posture status
      if (feedback.includes("Great posture!")) {
        changeStyleProperty('--posture-status',"'GOOD'");
        badPostureCount = 0;
      } else {
        changeStyleProperty('--posture-status',"'NEEDS IMPROVEMENT'");
        badPostureCount++;
      }

      // Provide audio feedback if needed
      if(badPostureCount >= 60){ // 60 frames = 2 seconds of bad posture
        showNotification("Posture needs attention!");
        
        const currentTime = Date.now();
        if (currentTime - lastAudioFeedbackTime > audioFeedbackInterval) {
          speakFeedback(feedback);
          setLastAudioFeedbackTime(currentTime);
        }
        
        badPostureCount = 0;
      }
    }

    if(btnSelected){
      goodPosture = landmarks; //obtain a copy of the "good pose"
      console.log("Calibrate button was clicked. New landmarks have been saved.");
      setBtn(false);
    }

    if(!goodPosture){ //the calibrate button has not been selected yet
      return;
    }
    
    //determine if the user's posture is bad or not
    if(badPosture(landmarks, goodPosture)){
      badPostureCount++;
      changeStyleProperty('--posture-status',"'BAD'"); //maybe move this inside conditional
      if(badPostureCount >= 60){ //60 frames = 2 seconds of bad posture
        showNotification("Correct your posture!");
        
        // Add audio feedback
        const currentTime = Date.now();
        if (currentTime - lastAudioFeedbackTime > audioFeedbackInterval) {
          speakFeedback(postureFeedback || "Your posture needs correction. Please sit up straight.");
          setLastAudioFeedbackTime(currentTime);
        }
        
        badPostureCount = 0;
      }
    }else{
      badPostureCount = 0;
      changeStyleProperty('--posture-status',"'GOOD'");
    }
  }

  useEffect(()=>{
    const pose = new Pose({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }});
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    pose.onResults(onResults);
    
    if(
      typeof webcamRef.current !== 'undefined' &&
      webcamRef.current !== null
    ) {
      const camera = new cam.Camera(webcamRef.current.video, {
        onFrame: async () => { //this block runs once every frame
          await pose.send({image: webcamRef.current.video});
        },
        width: 640,
        height: 480
      });
      camera.start();
    }

    if(!("Notification" in window)) {
      alert("Browser does not support desktop notification");
    } else {
      Notification.requestPermission();
    }

  }, []);
  

  return (
    <div className="flex flex-col min-h-screen">
      {!loaded && <LoadingScreen />}
      <div className={`flex-grow App bg-gradient-to-br from-deep-space to-space-gray flex flex-col items-center justify-center p-4 sm:p-8 ${!loaded ? 'hidden' : ''}`}>
        <div className="w-full max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-center space-y-8 xl:space-y-0 xl:space-x-8">
          <Menu
            postureRef={postureRef}
          />
          <div className="display relative rounded-3xl overflow-hidden w-full max-w-lg xl:max-w-xl bg-deep-space">
            <div className="absolute inset-0 bg-gradient-to-r from-neon-blue to-neon-green opacity-5 z-10"></div>
            <Webcam
              ref={webcamRef}
              className="webcam rounded-3xl w-full opacity-90"
              width="100%"
              height="auto"
            />
            <canvas
              ref={canvasRef}
              className="canvas absolute top-0 left-0 rounded-3xl w-full h-full z-20"
            />
            <div className="absolute top-4 left-4 bg-deep-space bg-opacity-70 text-neon-blue px-3 py-1 rounded-full text-sm font-medium z-30 backdrop-filter backdrop-blur-sm">
              Live Feed
            </div>
            {postureFeedback && (
              <div className="absolute bottom-4 left-4 right-4 bg-deep-space bg-opacity-70 text-neon-green px-3 py-2 rounded-lg text-sm font-medium z-30 backdrop-filter backdrop-blur-sm">
                {postureFeedback}
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="bg-deep-space text-neon-blue py-2 text-center">
        <p className="text-sm">made with 💌 by Prince</p>
      </footer>
    </div>
  );
}

export default App;
