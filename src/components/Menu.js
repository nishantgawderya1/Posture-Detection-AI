import { useState } from "react";
import { MenuHeader } from "./MenuHeader";
import { CalibrateBtn } from "./CalibrateBtn";
import { PostureStatus } from "./PostureStatus";
import logo from "../utils/Posture_Detector.png";

export let btnSelected = false;
export function setBtn(value) {
  btnSelected = value;
}

export function Menu(props) {
  const [state, setState] = useState("Calibration");
  const [audioEnabled, setAudioEnabled] = useState(true);

  const calibratePose = () => {
    if (props.postureRef.current === -1) {
      console.log("Cannot calibrate. No pose is detected.");
    } else {
      btnSelected = true;
      setState("Tracking");
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

  return (
    <div className="menu bg-deep-space bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-3xl p-6 sm:p-8 mb-4 sm:mb-8 w-full max-w-md mx-auto border border-neon-blue border-opacity-30">
      <div className="flex items-center justify-center mb-6">
        <img
          src={logo}
          className="w-20 h-20 sm:w-24 sm:h-24 animate-pulse-slow rounded-full"
          alt="logo"
        />
      </div>
      <MenuHeader state={state} />
      <PostureStatus state={state} />
      <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mt-6">
        <CalibrateBtn state={state} onClickCallback={calibratePose} />
        <button
          className="btn w-full sm:w-auto bg-space-gray text-neon-blue hover:bg-neon-blue hover:text-deep-space transition-colors duration-300"
          onClick={toggleAudio}
        >
          {audioEnabled ? "Disable Audio" : "Enable Audio"}
        </button>
      </div>
    </div>
  );
}
