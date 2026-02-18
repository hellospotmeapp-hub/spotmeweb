import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>

      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Mobile-first viewport - critical for TikTok/social sharing */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* PWA - Add to Home Screen */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SpotMe" />
        <meta name="application-name" content="SpotMe" />

        {/* Theme color for browser chrome */}
        <meta name="theme-color" content="#F2785C" />
        <meta name="msapplication-TileColor" content="#F2785C" />

        {/* SEO & Social Sharing (TikTok, Instagram, Twitter) */}
        <title>SpotMe - No Tragedy. Just Life.</title>
        <meta name="description" content="Help your neighbors with everyday needs. Small acts, big impact. Post a need or spot someone today." />

        {/* Open Graph for social sharing */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="SpotMe - No Tragedy. Just Life." />
        <meta property="og:description" content="Help your neighbors with everyday needs. Small acts, big impact. One payment can help multiple people." />
        <meta property="og:site_name" content="SpotMe" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SpotMe - No Tragedy. Just Life." />
        <meta name="twitter:description" content="Help your neighbors with everyday needs. Small acts, big impact." />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Preconnect to image CDN for faster loading */}
        <link rel="preconnect" href="https://d64gsuwffb70l.cloudfront.net" />
        <link rel="dns-prefetch" href="https://d64gsuwffb70l.cloudfront.net" />

        {/* Disable text size adjustment on mobile */}
        <ScrollViewStyleReset />

        {/* Critical CSS for instant load feel */}
        <style dangerouslySetInnerHTML={{ __html: `
          @viewport {
            width: device-width;
          }

          /* Reset & Base */
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
          }

          html, body {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
            background-color: #FAFAF8;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          #root {
            display: flex;
            height: 100%;
            flex-direction: column;
          }

          /* Mobile-first: full width on phones */
          /* Desktop: centered phone-width container */
          @media (min-width: 481px) {
            #root {
              max-width: 480px;
              margin: 0 auto;
              box-shadow: 0 0 40px rgba(0,0,0,0.08);
              border-left: 1px solid #E8E4DF;
              border-right: 1px solid #E8E4DF;
              position: relative;
            }

            body {
              background-color: #F0EDE9;
            }
          }

          /* Smooth scrolling */
          * {
            -webkit-overflow-scrolling: touch;
            scroll-behavior: smooth;
          }

          /* Remove default input styling on iOS */
          input, textarea, select {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            border-radius: 0;
            font-size: 16px !important; /* Prevent iOS zoom on input focus */
          }

          /* Disable pull-to-refresh on Chrome mobile */
          body {
            overscroll-behavior-y: contain;
          }

          /* Safe area padding for notched phones */
          .safe-area-top {
            padding-top: env(safe-area-inset-top, 0px);
          }

          .safe-area-bottom {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }

          /* Loading screen styles (created dynamically via JS) */
          #splash-screen {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #FAFAF8;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            z-index: 99999;
            transition: opacity 0.3s ease-out;
          }

          #splash-screen.hidden {
            opacity: 0;
            pointer-events: none;
          }

          #splash-logo {
            font-size: 42px;
            font-weight: 900;
            color: #F2785C;
            letter-spacing: -1px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          #splash-tagline {
            font-size: 15px;
            color: #A9A29B;
            font-style: italic;
            margin-top: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          #splash-loading {
            margin-top: 32px;
            width: 40px;
            height: 4px;
            background-color: #FFF0EC;
            border-radius: 2px;
            overflow: hidden;
          }

          #splash-loading::after {
            content: '';
            display: block;
            width: 50%;
            height: 100%;
            background-color: #F2785C;
            border-radius: 2px;
            animation: loading 1s ease-in-out infinite;
          }

          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }

          /* Prevent text selection on UI elements */
          button, [role="button"] {
            -webkit-user-select: none;
            user-select: none;
            cursor: pointer;
          }

          /* Better image rendering */
          img {
            -webkit-user-drag: none;
            user-select: none;
          }

          /* Custom scrollbar for desktop */
          @media (min-width: 481px) {
            ::-webkit-scrollbar {
              width: 4px;
            }
            ::-webkit-scrollbar-track {
              background: transparent;
            }
            ::-webkit-scrollbar-thumb {
              background: #E8E4DF;
              border-radius: 2px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: #A9A29B;
            }
          }

          /* Hide scrollbar on mobile */
          @media (max-width: 480px) {
            ::-webkit-scrollbar {
              display: none;
            }
            * {
              scrollbar-width: none;
            }
          }
        `}} />

        {/* 
          Splash screen + utilities script in <head>.
          This creates the splash screen dynamically via JS so it stays 
          outside React's hydration scope, preventing error #418.
        */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // Create splash screen dynamically (outside React's DOM tree)
            var splash = document.createElement('div');
            splash.id = 'splash-screen';
            splash.innerHTML = '<div id="splash-logo">SpotMe</div><div id="splash-tagline">No tragedy. Just life.</div><div id="splash-loading"></div>';
            document.addEventListener('DOMContentLoaded', function() {
              if (document.body) {
                document.body.appendChild(splash);
              }
            });

            // Hide splash screen when app is ready
            function hideSplash() {
              var s = document.getElementById('splash-screen');
              if (s) {
                s.classList.add('hidden');
                setTimeout(function() { if (s.parentNode) s.parentNode.removeChild(s); }, 300);
              }
            }

            // Hide after load event
            window.addEventListener('load', function() {
              setTimeout(hideSplash, 400);
            });

            // Fallback: always hide after 3 seconds
            setTimeout(hideSplash, 3000);

            // Register service worker for PWA
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              });
            }

            // Prevent double-tap zoom on iOS
            var lastTouchEnd = 0;
            document.addEventListener('touchend', function(event) {
              var now = Date.now();
              if (now - lastTouchEnd <= 300) {
                event.preventDefault();
              }
              lastTouchEnd = now;
            }, false);
          })();
        `}} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
