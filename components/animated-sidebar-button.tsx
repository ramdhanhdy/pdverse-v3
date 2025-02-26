'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface AnimatedSidebarButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export default function AnimatedSidebarButton({ onClick, isOpen }: AnimatedSidebarButtonProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait for mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = mounted && resolvedTheme === 'dark';
  const iconColor = isDarkMode ? '#f0eeef' : '#000000';
  const borderColor = isDarkMode ? '#f0eeef' : '#000000';
  const bgColor = isDarkMode ? '#1e1e2e' : '#ffffff';

  return (
    <div className="styled-wrapper">
      <button className="button" onClick={onClick} aria-label={isOpen ? "Hide Sidebar" : "Show Sidebar"}>
        <div className={`button-box ${isOpen ? '' : 'rotated'}`}>
          <span className="button-elem">
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="arrow-icon"
            >
              <path
                fill={iconColor}
                d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              ></path>
            </svg>
          </span>
          <span className="button-elem">
            <svg
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="arrow-icon"
            >
              <path
                fill={iconColor}
                d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
              ></path>
            </svg>
          </span>
        </div>
      </button>

      <style jsx>{`
        .styled-wrapper {
          position: relative;
          width: 32px;
          height: 32px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          border-radius: 50%;
          background-color: ${bgColor};
          z-index: 30;
        }
        
        .styled-wrapper .button {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          width: 32px;
          height: 32px;
          margin: 0;
          overflow: hidden;
          outline: none;
          background-color: transparent;
          cursor: pointer;
          border: 0;
          border-radius: 50%;
        }

        .styled-wrapper .button:before {
          content: "";
          position: absolute;
          border-radius: 50%;
          inset: 3px;
          border: 1.5px solid ${borderColor};
          transition:
            opacity 0.4s cubic-bezier(0.77, 0, 0.175, 1) 80ms,
            transform 0.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 80ms;
        }

        .styled-wrapper .button:after {
          content: "";
          position: absolute;
          border-radius: 50%;
          inset: 3px;
          border: 1.5px solid ${isDarkMode ? '#599a53' : '#599a53'};
          transform: scale(1.3);
          transition:
            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1),
            transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          opacity: 0;
        }

        .styled-wrapper .button:hover:before,
        .styled-wrapper .button:focus:before {
          opacity: 0;
          transform: scale(0.7);
          transition:
            opacity 0.4s cubic-bezier(0.165, 0.84, 0.44, 1),
            transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .styled-wrapper .button:hover:after,
        .styled-wrapper .button:focus:after {
          opacity: 1;
          transform: scale(1);
          transition:
            opacity 0.4s cubic-bezier(0.77, 0, 0.175, 1) 80ms,
            transform 0.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) 80ms;
        }

        .styled-wrapper .button-box {
          display: flex;
          position: absolute;
          height: 100%;
          width: 100%;
          align-items: center;
          justify-content: center;
          transition: transform 0.4s ease;
        }
        
        .styled-wrapper .button-box.rotated {
          transform: rotate(180deg);
        }

        .styled-wrapper .button-elem {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          position: absolute;
        }
        
        .styled-wrapper .button-elem:nth-child(1) {
          opacity: 1;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        
        .styled-wrapper .button-elem:nth-child(2) {
          opacity: 0;
          transform: translateX(-20px);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .styled-wrapper .button:hover .button-elem:nth-child(1) {
          opacity: 0;
          transform: translateX(20px);
        }
        
        .styled-wrapper .button:hover .button-elem:nth-child(2) {
          opacity: 1;
          transform: translateX(0);
        }
        
        .styled-wrapper .arrow-icon {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
