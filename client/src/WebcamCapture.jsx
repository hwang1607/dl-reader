import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  Fragment,
} from "react";
import Webcam from "react-webcam";
import cv from "@techstark/opencv-js";
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
  const [ocrProcessing, setOcrProcessing] = useState(false); // State to track OCR processing

  useEffect(() => {
    cv.onRuntimeInitialized = () => {
      console.log("OpenCV loaded");
    };
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        processImageToGrayscale(e.target.result);
      };
      reader.readAsDataURL(file);
      event.target.value = ""; // Reset the file input after uploading
    }
  };

  const processImageToGrayscale = (imageSrc) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0, img.width, img.height);

    let src = cv.imread(canvas); // Changed from 'const' to 'let' to allow reassignment

    setOcrProcessing(true); // Set to true before starting OCR

    // Convert image to grayscale
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);

    // Use Canny edge detection to find edges
    const edges = new cv.Mat();
    cv.Canny(src, edges, 50, 150, 3);
    
    // Detect lines using HoughLinesP
    const lines = new cv.Mat();
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 50, 10);
    
    let angleSum = 0;
    let numAngles = 0;
    for (let i = 0; i < lines.rows; ++i) {
        const [x1, y1, x2, y2] = lines.data32S.subarray(i * 4, (i + 1) * 4);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180.0 / Math.PI;
        if (Math.abs(angle) < 45) {
            angleSum += angle;
            numAngles++;
        }
    }
    
    let averageAngle = 0;
    if (numAngles > 0) {
        averageAngle = angleSum / numAngles;
    }
    
    const center = new cv.Point(src.cols / 2, src.rows / 2);
    const rotationMatrix = cv.getRotationMatrix2D(center, -averageAngle, 1);
    const rotated = new cv.Mat();
    cv.warpAffine(src, rotated, rotationMatrix, new cv.Size(src.cols, src.rows));

    src.delete(); // Delete the original source matrix
    src = rotated; // Reassign 'src' with 'rotated'

    // Apply Otsu's thresholding
    const dst = new cv.Mat();
    cv.threshold(src, dst, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU); // Using 'src' after correction

    // Convert the thresholded image to RGBA format to display it using canvas
    const rgbaDst = new cv.Mat();
    cv.cvtColor(dst, rgbaDst, cv.COLOR_GRAY2RGBA);

    const processedImgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      img.width,
      img.height
    );

    context.putImageData(processedImgData, 0, 0);
    setImgSrc(canvas.toDataURL());

    // Proceed with OCR as before...

    // Clean up
    edges.delete();
    lines.delete();
    rotationMatrix.delete();
    src.delete(); // Ensure 'src' is deleted after its final use
    dst.delete();
    rgbaDst.delete();
  };
  img.src = imageSrc;
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
      lines[i] = lines[i].toUpperCase();
      if (lines[i].includes("LN")) {
        data.lastName = lines[i].split("LN")[1].trim();
      }
      if (lines[i].includes("FN")) {
        data.firstName = lines[i].split("FN")[1].trim();
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
        let expText = lines[i].split("EXP")[1].trim(); // Get the text after "EXP"
        let firstElement = expText.split(" ")[0]; // Split by spaces and take the first element
        data.expirationDate = firstElement;
      }
      if (lines[i].includes("ISS")) {
        if (lines[i + 1]) {
          const parts = lines[i + 1].trim().split(" ");
          data.issuanceDate = parts[parts.length - 1];
        }
      }
    }

    return data;
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      processImageToGrayscale(imageSrc);
    }
  }, [webcamRef]);

  return (
    <Fragment>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {ocrProcessing ? ( // Display a message based on the OCR processing state
          <div style={{ marginTop: "2vh", marginBottom: "2vh" }}>
            Processing image...
          </div>
        ) : (
          <div style={{ marginTop: "2vh", marginBottom: "2vh" }}>&nbsp;</div>
        )}
      </div>
      <div className="button-container">
        <button
          onClick={capture}
          style={{ marginTop: "0px", marginBottom: "50px" }}
        >
          Capture photo
        </button>
        <button
          style={{ marginTop: "0px", marginBottom: "50px" }}
          onClick={() => document.getElementById("fileInput").click()}
        >
          Upload photo
        </button>
      </div>
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
              forceScreenshotSourceSize
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
