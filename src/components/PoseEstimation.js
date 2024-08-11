import React, { useEffect, useRef, useState } from 'react';
import * as posedetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import './PoseEstimation.css';
import guidanceVideoSrc from './assets/guidance.mp4';

var post = "UP"

const PoseEstimation = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [pos, setPos] = useState("UP");
  const [count, setCount] = useState(0);
  const [score, setScore] = useState(0);
  const [someCoord, setSomeCoord] = useState([0, 0]);
  const guidanceVideoRef = useRef(null);

  useEffect(() => {
    const runPoseEstimation = async () => {
      try {
        await tf.ready();
        await tf.setBackend('webgl');

        const detector = await posedetection.createDetector(
          posedetection.SupportedModels.MoveNet
        );

        const video = videoRef.current;
        const guidanceVideo = guidanceVideoRef.current;

        const startVideo = () => {
          navigator.mediaDevices.getUserMedia({
            video: true
          }).then((stream) => {
            video.srcObject = stream;
          }).catch((err) => {
            console.error("Error accessing camera: ", err);
          });
        };

        video.onloadedmetadata = () => {
          // Ensure that video dimensions are set correctly
          video.width = video.videoWidth || 640; // Default to 640 if videoWidth is 0
          video.height = video.videoHeight || 480; // Default to 480 if videoHeight is 0
          canvasRef.current.width = video.width;
          canvasRef.current.height = video.height;

          video.play();
          detectPoses(); // Start pose detection after video is ready
        };

        guidanceVideo.src = guidanceVideoSrc; // Set the source from imported path
        guidanceVideo.loop = true
        guidanceVideo.onloadedmetadata = () => {
          guidanceVideo.play();
        };

        const detectPoses = async () => {
          try {
            // Skip processing if video dimensions are not yet set
            if (video.width === 0 || video.height === 0) {
              requestAnimationFrame(detectPoses);
              return;
            }

            const poses = await detector.estimatePoses(video);
            if (canvasRef.current) {
              count_squats(poses); // Call count_squats to process the pose data
              drawPoses(poses);
            }
            requestAnimationFrame(detectPoses);
          } catch (error) {
            console.error("Error in pose detection:", error);
          }
        };

        const drawPoses = (poses) => {
          try {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            poses.forEach((pose) => {
              const connections = [
                [0, 1], [0, 2], [1, 3], [2, 4],
                [5, 6], [5, 7], [7, 9],
                [6, 8], [8, 10],
                [11, 12], [5, 11], [6, 12],
                [11, 13], [13, 15], [12, 14], [14, 16]
              ];

              pose.keypoints.forEach((keypoint, index) => {
                const { x, y, score } = keypoint;
                if (score > 0.3) {
                  ctx.beginPath();
                  ctx.arc(x, y, 5, 0, 2 * Math.PI);
                  ctx.fillStyle = 'red';
                  ctx.fill();
                }
              });

              connections.forEach(([i, j]) => {
                const kp1 = pose.keypoints[i];
                const kp2 = pose.keypoints[j];
                if (kp1.score > 0.3 && kp2.score > 0.3) {
                  ctx.beginPath();
                  ctx.moveTo(kp1.x, kp1.y);
                  ctx.lineTo(kp2.x, kp2.y);
                  ctx.strokeStyle = 'lime';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                }
              });
            });
          } catch (error) {
            console.error("Error in drawing poses:", error);
          }
        };

        const count_squats = (poses) => {
          poses.forEach((pose) => {
            const leftShoulder = pose.keypoints.find(k => k.name === 'left_shoulder');
            const rightShoulder = pose.keypoints.find(k => k.name === 'right_shoulder');
            const leftKnee = pose.keypoints.find(k => k.name === 'left_knee');
            const rightKnee = pose.keypoints.find(k => k.name === 'right_knee');
            const leftAnkle = pose.keypoints.find(k => k.name === 'left_ankle');
            const rightAnkle = pose.keypoints.find(k => k.name === 'right_ankle');
            const rightHip = pose.keypoints.find(k => k.name === "right_hip")
            const leftHip = pose.keypoints.find(k => k.name === "left_hip")

            if (
              leftShoulder && rightShoulder && leftKnee && rightKnee &&
              leftAnkle && rightAnkle &&
              leftShoulder.score > 0.3 && rightShoulder.score > 0.3 &&
              leftKnee.score > 0.3 && rightKnee.score > 0.3 &&
              leftAnkle.score > 0.3 && rightAnkle.score > 0.3
            ) {
              const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
              const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
              const kneeY = (leftKnee.y + rightKnee.y) / 2;
              const kneeX = (leftKnee.x + rightKnee.x) / 2;
              const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
              const ankleX =(leftAnkle.x + rightAnkle.x) / 2;
              const hipY = (leftHip.y + rightHip.y)/2;
              const hipX = (leftHip.x + rightHip.x)/2;
              const delta = 10
              setSomeCoord([Math.round(hipY), Math.round(kneeY), pos])
              // console.log(post)

              if (post === "UP" &&kneeY < hipY - delta) {
                setPos("DOWN");
                post = "DOWN"
              } 
              if (post === "DOWN" && kneeY > hipY + delta) {
                setPos("UP");
                post = "UP"
                setCount(prevCount => prevCount + 1);
              }

              const m1 = (shoulderY - hipY)/(shoulderX - hipX);
              const m2 = (kneeY - ankleY)/(kneeX - ankleX);
              
              // Calculate the angle in radians using the formula
              const angleRadians = Math.atan(Math.abs((m1 - m2) / (1 + m1 * m2)));
              
              // Convert radians to degrees
              const angleDegrees = angleRadians * (180 / Math.PI);
              const squatScore = (1 - (angleDegrees)/150)*100;

              setScore(Math.round(squatScore));
            }
          });
        };

        startVideo();
      } catch (error) {
        console.error("Error in running pose estimation:", error);
      }
    };

    runPoseEstimation();
  }, [pos, count, score, someCoord]);

  return (
    <div><h1>Please follow this instruction: </h1>
    <div className="pose-estimation-container">
      <div className="pose-estimation">
        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} />
      </div>
      <div className="video-guidance">
        <video ref={guidanceVideoRef} controls loop /> {/* Added loop attribute */}
      </div>
      <SquatInfo pos={pos} count={count} score={score} someCoord={someCoord}/>
    </div>
    </div>
  );
};

const SquatInfo = ({ pos, count, score, someCoord }) => {
  return (
    <div className='squat_info'>
      {/* <h1 className={`status ${pos.toLowerCase()}`}>{pos}</h1> */}
      <h1 className='count'>{count} Squats</h1>
      <h1 className='score'>{score}% Score</h1>
      {/* {<h1>hip:{someCoord[0]}px knee:{someCoord[1]}px and {someCoord[2]}</h1>} */}
    </div>
  );
};

export default PoseEstimation;
