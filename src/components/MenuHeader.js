export function MenuHeader(props) {
    if(props.state === "Calibration"){
      return(
        <div className="text-neon-blue">
          <h3 className="text-2xl font-bold mb-4">Welcome to Posture Detection AI</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>Make sure your webcam is enabled and aimed straight at you</li>
            <li> Sit up straight with "good" posture, ensuring your head and shoulders are within the frame</li>
            <li>Press the "Calibrate" button below</li>
            <li>Go ahead and use your computer normally. We'll alert you if you start to slouch!</li>
          </ol>
        </div>
      );
    } else if(props.state === "Tracking"){
      return(
        <div className="text-neon-green">
          <h3 className="text-2xl font-bold mb-4">Tracking Posture</h3>
          <p>To recalibrate, click "Calibrate" again.</p>
        </div>
      );
    }
}
