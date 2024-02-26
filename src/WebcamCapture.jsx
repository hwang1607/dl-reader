import React, { useRef, useState, useCallback, Fragment } from "react";
import Webcam from "react-webcam";
import Tesseract from "tesseract.js";

const WebcamCapture = () => {
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [webcamError, setWebcamError] = useState(false);
  const [extractedData, setExtractedData] = useState({
    firstName: "",
    lastName: "",
    address: "",
    issuanceDate: "",
    expirationDate: "",
  });

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImgSrc(e.target.result); // Display the selected image
        Tesseract.recognize(e.target.result, "eng", {}).then(
          ({ data: { text } }) => {
            console.log(text);
            const extractedData = parseDriverLicenseData(text);
            setExtractedData(extractedData);
          }
        );
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    }
  };

  const parseDriverLicenseData = (text) => {
    const data = {
      firstName: "",
      lastName: "",
      address: "",
      issuanceDate: "",
      expirationDate: "",
    };

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("FN")) {
        data.firstName = lines[i].split("FN")[1].trim();
      }
      if (lines[i].includes("LN")) {
        data.lastName = lines[i].split("LN")[1].trim();
        // Assuming the address is immediately below the last name
        if (
          lines[i + 1] &&
          !lines[i + 1].includes("EXP") &&
          !lines[i + 1].includes("ISS")
        ) {
          data.address = lines[i + 1].trim();
        }
      }
      if (lines[i].includes("EXP")) {
        data.expirationDate = lines[i].split("EXP")[1].trim();
      }
      if (lines[i].includes("ISS")) {
        data.issuanceDate = lines[i].split("ISS")[1].trim();
      }
    }

    return data;
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setImgSrc(imageSrc);

    Tesseract.recognize(imageSrc, "eng", {}).then(({ data: { text } }) => {
      console.log(text);
      const extractedData = parseDriverLicenseData(text);
      setExtractedData(extractedData);
    });
  }, [webcamRef]);

  return (
    <Fragment>
      <button
        onClick={capture}
        style={{ marginTop: "30px", marginBottom: "30px" }}
      >
        Capture photo
      </button>
      <button
        style={{ marginTop: "0px", marginBottom: "50px" }}
        onClick={() => document.getElementById("fileInput").click()}
      >
        Upload photo
      </button>
      <input
        type="file"
        id="fileInput"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <div className="content-container">
        <div className="camera">
          {!webcamError ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              videoConstraints={{ facingMode: "environment" }} // This line requests the rear camera
              screenshotFormat="image/jpeg"
              width="100%"
              height="100%"
              onUserMediaError={() => setWebcamError(true)}
            />
          ) : (
            <div className="DefaultBox">Webcam access denied</div>
          )}
        </div>

        {imgSrc ? (
          <img src={imgSrc} alt="Captured" className="camera" />
        ) : (
          <div className="DefaultBox">Capture or upload photo</div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ marginTop: "20px", marginBottom: "50px" }}>
          <h3>Extracted Information</h3>
          <p>
            <strong>First Name:</strong> {extractedData.firstName}
          </p>
          <p>
            <strong>Last Name:</strong> {extractedData.lastName}
          </p>
          <p>
            <strong>Address:</strong> {extractedData.address}
          </p>
          <p>
            <strong>Issuance Date:</strong> {extractedData.issuanceDate}
          </p>
          <p>
            <strong>Expiration Date:</strong> {extractedData.expirationDate}
          </p>
        </div>
      </div>
    </Fragment>
  );
};

export default WebcamCapture;
