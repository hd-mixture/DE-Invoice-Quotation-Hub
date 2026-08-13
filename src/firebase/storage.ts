const CLOUDINARY_CLOUD_NAME = "dtdgxqt6p";
const CLOUDINARY_UPLOAD_PRESET = "c6WgJagx-LI1EBO9DxtvrVawkzc";

/**
 * Uploads a file (or Blob) to Cloudinary and returns its secure URL.
 * Falls back to Base64 if the request fails, keeping the system bulletproof.
 */
export async function uploadSettingImage(path: string, file: File | Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "darshan_enterprises");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary upload HTTP failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.warn("Cloudinary upload failed, falling back to base64. Preset might be signed. Error details:", error);
    
    // Return base64 as fallback so that the app remains functional even if Cloudinary has preset/region constraints
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          resolve(""); // Return empty instead of crashing
        }
      };
      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsDataURL(file);
    });
  }
}

/**
 * Helper to convert File to Base64 directly
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Uploads a PO attachment (Image or PDF) to Cloudinary.
 * Falls back to Base64 if the upload fails, keeping the system resilient.
 */
export async function uploadPoAttachment(file: File | Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "darshan_enterprises");

    // Since the preset is configured for images, we upload both images and PDFs to image/upload.
    // Cloudinary natively accepts PDF files as the 'image' resource type to generate thumbnails.
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        // Ignore JSON parse fails
      }
      throw new Error(`Cloudinary PO upload HTTP failed: ${errorMessage}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.warn("Cloudinary PO upload failed, falling back to base64. Preset might be signed. Error details:", error);
    
    // Return base64 as fallback so that the app remains functional
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          resolve(""); // Return empty instead of crashing
        }
      };
      reader.onerror = () => reject(new Error("File reading failed"));
      reader.readAsDataURL(file);
    });
  }
}
