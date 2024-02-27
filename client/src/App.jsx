import React from "react";
import "./App.css";
import WebcamCapture from "./WebcamCapture";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div style={{ padding: '10px' }}>
          <h1>Driver's License Reader</h1>
          <div>
            <WebcamCapture />
          </div>
        </div>
      </header>
    </div>
  );
}


export default App;
