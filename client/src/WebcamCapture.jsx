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
        preprocessImage(e.target.result);
      };
      reader.readAsDataURL(file);
      event.target.value = ""; // Reset the file input after uploading
    }
  };

  const preprocessImage = (imageSrc) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      context.drawImage(img, 0, 0);

      const src = cv.imread(canvas);
      setOcrProcessing(true); // Start OCR processing indicator

      // Convert to grayscale
      let gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply Gaussian blur to reduce noise
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(1, 1), 0);

      // Use Otsu's method to find a global threshold and apply it in Canny edge detection
      const otsuThreshold = cv.threshold(
        blurred,
        new cv.Mat(),
        0,
        255,
        cv.THRESH_BINARY | cv.THRESH_OTSU
      );
      const edges = new cv.Mat();
      cv.Canny(blurred, edges, 0.1 * otsuThreshold, otsuThreshold);

      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      // Find the largest contour
      let maxArea = 0;
      let maxContour = null;
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        if (area > maxArea) {
          maxArea = area;
          maxContour = contour;
        }
      }

      if (maxContour) {
        const rect = cv.boundingRect(maxContour);
        const imageArea = img.width * img.height;
        const rectArea = rect.width * rect.height;
        const areaRatio = rectArea / imageArea;

        if (areaRatio > 0.4) {
          // Crop if the area is more than 30% of the image size
          let roi = gray.roi(rect);
          gray.delete(); // Delete the old gray image to free memory
          gray = roi.clone(); // Use the cropped area as the new gray image
          roi.delete(); // Clean up the temporary ROI
          // Note: The rectangle is not drawn in this case because we crop to the ROI
        } else {
          // Draw the rectangle on the original gray image
          const color = new cv.Scalar(255, 0, 0, 255);
          cv.rectangle(
            gray,
            new cv.Point(rect.x, rect.y),
            new cv.Point(rect.x + rect.width, rect.y + rect.height),
            color,
            2
          );
        }
      } else {
        console.log(
          "No suitable contour found. Proceeding with full image OCR."
        );
      }

      processImageWithTesseract(gray, canvas, context); // Process the entire image if no specific cropping is done

      // Cleanup
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
    };
    img.src = imageSrc;
  };
  const processImageWithTesseract = (grayImageMat, canvas, context) => {
    // Make sure canvas size matches the new image dimensions if it was cropped or altered
    canvas.width = grayImageMat.cols;
    canvas.height = grayImageMat.rows;

    // Convert the grayscale image to RGBA format to display it using canvas
    const rgbaDst = new cv.Mat();
    cv.cvtColor(grayImageMat, rgbaDst, cv.COLOR_GRAY2RGBA);

    // Ensure the processedImgData is correctly sized for the canvas
    const processedImgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      canvas.width, // Use updated width
      canvas.height // Use updated height
    );
    context.putImageData(processedImgData, 0, 0);
    setImgSrc(canvas.toDataURL());

    // The rest of the OCR processing using Tesseract.js
    Tesseract.recognize(canvas.toDataURL(), "eng")
      .then(({ data: { text } }) => {
        console.log("OCR Result:", text);
        const parsedData = parseDriverLicenseData(text);
        setExtractedData(parsedData); // Update state with parsed data
        setOcrProcessing(false); // Indicate OCR processing is complete
      })
      .catch((err) => {
        console.error("Error during OCR:", err);
        setOcrProcessing(false); // Handle errors in OCR processing
      });

    rgbaDst.delete(); // Clean up
  };

  const parseDriverLicenseData = (text) => {
    const data = {
      firstName: "",
      lastName: "",
      address: "",
      issuanceDate: "",
      expirationDate: "",
    };

    const removeSymbolsRegex = /[^a-zA-Z0-9\s,.-]/g;
    const dateRegex = /[^0-9\/]/g;

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      lines[i] = lines[i].toUpperCase();
      if (lines[i].includes("LN")) {
        data.lastName = lines[i]
          .split("LN")[1]
          .trim()
          .replace(removeSymbolsRegex, "");
      }
      if (lines[i].includes("FN")) {
        data.firstName = lines[i]
          .split("FN")[1]
          .trim()
          .replace(removeSymbolsRegex, "");
        // Assuming the address is immediately below the last name
        if (
          lines[i + 1] &&
          !lines[i + 1].includes("EXP") &&
          !lines[i + 1].includes("ISS")
        ) {
          data.address = lines[i + 1].trim().replace(removeSymbolsRegex, "");
        }
      }
      if (lines[i].includes("EXP")) {
        let expText = lines[i].split("EXP")[1].trim(); // Get the text after "EXP"
        let firstElement = expText.split(" ")[0].replace(dateRegex, ""); // Remove unwanted symbols from date
        data.expirationDate = firstElement;
      }
      if (lines[i].includes("ISS")) {
        if (lines[i + 1]) {
          const parts = lines[i + 1].trim().split(" ");
          // Assuming the last part is the date, remove unwanted symbols from it
          data.issuanceDate = parts[parts.length - 1].replace(dateRegex, "");
        }
      }
    }

    return data;
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      preprocessImage(imageSrc);
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
