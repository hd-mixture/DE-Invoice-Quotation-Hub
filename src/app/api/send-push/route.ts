import { db } from "../../../firebase/config";
import { collection, getDocs } from "firebase/firestore";
import { NextResponse } from "next/server";
import webpush from "web-push";

// Configure VAPID details for WebPush payload signing using environment variables
webpush.setVapidDetails(
  'mailto:admin@darshan-enterprises.com',
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BMC2IrZ7PwRo8iJ1BXYnSl4_cOdbXLMJxOQJwRZf06c1gP7WDJ1_z-G8vlTJaBZkjwSYinna33sEM1MXSEuIiM4',
  process.env.FIREBASE_PRIVATE_VAPID_KEY || 'H-VX_C65EGi61d4gNUjzhaV1qYJq48ZhtpadzpKt5Lc'
);

const TAGLINES = {
  morning: [
    "Hii '{name}'! Kickstart your workday! Create professional Quotations & Invoices in seconds.",
    "Rise and shine, '{name}'! Let's clear your billing checklist before your morning coffee.",
    "A productive morning starts here, '{name}'! Generate your invoices with one click."
  ],
  lunch: [
    "🍽️ Hii '{name}' Create a Quotation in a minute... until you finish your lunch!",
    "🍽️ Hello '{name}' Quick invoice during your lunch break? Done in less than 60 seconds."
  ],
  afternoon: [
    "Beat the afternoon slump, '{name}'! Power through your quotations instantly.",
    "Hello '{name}'! Close your business deals today! Send beautiful quotations in a flash."
  ],
  evening: [
    "Wrap up your day in style, '{name}'! Sync and save your final invoices flawlessly.",
    "All caught up, '{name}'? Sleep easy knowing your billing details are safely synced!"
  ]
};

// Select tagline based on local Indian Standard Time (IST, UTC+5:30)
const getPersonalizedTagline = (name: string): string => {
  const utcDate = new Date();
  // Adjust to Indian Standard Time (IST, GMT+5:30)
  const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
  const hour = istDate.getUTCHours();
  
  let category: "morning" | "lunch" | "afternoon" | "evening";

  if (hour >= 6 && hour < 12) {
    category = "morning";
  } else if (hour >= 12 && hour < 14) {
    category = "lunch";
  } else if (hour >= 14 && hour < 18) {
    category = "afternoon";
  } else {
    category = "evening";
  }

  const list = TAGLINES[category];
  const randomIndex = Math.floor(Math.random() * list.length);
  const template = list[randomIndex];
  return template.replace(/{name}/g, name || "there");
};

export async function GET() {
  try {
    console.log("[Autopilot Push Engine] Running background job...");
    
    // Fetch all active user settings documents from admin collection in Firestore
    const adminSnapshot = await getDocs(collection(db, "admin"));
    const promises: Promise<any>[] = [];
    let sentCount = 0;

    adminSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const subscription = data.fcmSubscription;
      const userName = data.userName || "Valued User";

      if (subscription && subscription.endpoint) {
        const tagline = getPersonalizedTagline(userName);
        const payload = JSON.stringify({
          notification: {
            title: "Darshan Enterprises",
            body: tagline,
            icon: "/Graphic Assets/DARSHAN ENTERPRISES Logo.jpg",
            badge: "/favicon.ico"
          }
        });

        promises.push(
          webpush.sendNotification(subscription, payload)
            .then(() => {
              console.log(`[Autopilot Engine] Push successfully delivered to user: ${userName}`);
              sentCount++;
            })
            .catch((err) => {
              console.error(`[Autopilot Engine] Failed to send push to user: ${userName}:`, err);
            })
        );
      }
    });

    await Promise.all(promises);
    return NextResponse.json({
      success: true,
      message: `Autopilot Push Engine completed successfully. Sent to ${sentCount} active devices.`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Autopilot Push Engine] General execution error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown execution error"
    }, { status: 500 });
  }
}
