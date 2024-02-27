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

      const src = cv.imread(canvas);

      setOcrProcessing(true); // Set to true before starting OCR

      // Convert the image to grayscale
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply Otsu's thresholding
      const dst = new cv.Mat();
      cv.threshold(gray, dst, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

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

      // Perform OCR with Tesseract.js
      Tesseract.recognize(
        canvas.toDataURL(), // Use the canvas data URL as input
        "eng", // Language (e.g., English)
        { logger: (m) => console.log(m) } // Optional logger function
      )
        .then(({ data: { text } }) => {
          console.log("OCR Result:", text); // Print the OCR result to console

          // Here you can call `parseDriverLicenseData` with the `text`
          const parsedData = parseDriverLicenseData(text);
          setExtractedData(parsedData); // Update state with parsed data
          setOcrProcessing(false); // Set to false after OCR completes
        })
        .catch((err) => {
          console.error("Error during OCR:", err); // Handle any errors
          setOcrProcessing(false); // Set to false after OCR completes
        });

      // Clean up
      src.delete();
      gray.delete();
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
