import { auth, db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

interface DriveUploadResult {
  driveUrl: string;
  driveFileId: string;
}

/**
 * Silently renews the Google access token using the stored refresh token in Firestore
 */
async function refreshAccessToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("Cannot refresh access token in Drive service: No user authenticated in Firebase.");
    return null;
  }

  try {
    const tokenDocRef = doc(db, "users", currentUser.uid, "secure", "googleDrive");
    const tokenDocSnap = await getDoc(tokenDocRef);

    if (!tokenDocSnap.exists()) {
      console.warn("No stored Google refresh token available for user UID:", currentUser.uid);
      return null;
    }

    const refreshToken = tokenDocSnap.data().refreshToken;
    if (!refreshToken) {
      console.warn("Refresh token is missing from Firestore secure document.");
      return null;
    }

    // Call the refresh API route
    const response = await fetch("/api/auth/google/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();
    if (response.ok && data.accessToken) {
      console.log("Drive service auto-renewed access token successfully.");
      localStorage.setItem("google_drive_access_token", data.accessToken);
      return data.accessToken;
    }

    console.warn("Drive service failed to exchange refresh token for new access token:", data.error);
    return null;
  } catch (err) {
    console.error("Google Drive service encountered error during silent token refresh:", err);
    return null;
  }
}

/**
 * Searches for a folder named "DE-Quotation" in the user's Drive.
 * If found, returns its ID. If not found, creates the folder and returns its ID.
 */
async function getOrCreateAppFolder(accessToken: string, folderName: string = "DE-Quotation"): Promise<string> {
  let activeToken = accessToken;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    // 1. Search for the folder
    const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
    const searchUrl = `${DRIVE_FILES_URL}?q=${query}&fields=files(id,name)`;
    
    const searchResponse = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });

    if (!searchResponse.ok) {
      if (searchResponse.status === 401 && attempts < maxAttempts - 1) {
        attempts++;
        console.warn(`Drive API 401 caught inside getOrCreateAppFolder. Retrying... (attempt ${attempts}/${maxAttempts})`);
        const renewedToken = await refreshAccessToken();
        if (renewedToken) {
          activeToken = renewedToken;
          continue; // Retry request with the new token
        }
      }

      let errorMsg = `Status ${searchResponse.status}`;
      try {
        const errJson = await searchResponse.json();
        if (errJson.error && errJson.error.message) {
          errorMsg += `: ${errJson.error.message}`;
        }
      } catch {}

      if (searchResponse.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("google_drive_access_token");
          window.dispatchEvent(new Event("google-session-expired"));
        }
        throw new Error("Your Google Drive access token has expired and could not be silently renewed. Please log in again.");
      }
      throw new Error(`Failed to search Google Drive folders: ${errorMsg}`);
    }

    const searchData = await searchResponse.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // 2. Create the folder if not found
    const createResponse = await fetch(DRIVE_FILES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (!createResponse.ok) {
      if (createResponse.status === 401 && attempts < maxAttempts - 1) {
        attempts++;
        console.warn(`Drive API 401 caught inside getOrCreateAppFolder create action. Retrying... (attempt ${attempts}/${maxAttempts})`);
        const renewedToken = await refreshAccessToken();
        if (renewedToken) {
          activeToken = renewedToken;
          continue; // Retry loop
        }
      }

      let errorMsg = `Status ${createResponse.status}`;
      try {
        const errJson = await createResponse.json();
        if (errJson.error && errJson.error.message) {
          errorMsg += `: ${errJson.error.message}`;
        }
      } catch {}
      throw new Error(`Failed to create Google Drive folder: ${errorMsg}`);
    }

    const createData = await createResponse.json();
    return createData.id;
  }

  throw new Error("Failed to search/create Google Drive folder due to repeated authorization errors.");
}

/**
 * Uploads a PDF Blob to the "DE-Quotation" folder on Google Drive.
 * Returns the file webViewLink and driveFileId.
 */
export async function uploadPdfToGoogleDrive(
  accessToken: string,
  pdfBlob: Blob,
  fileName: string,
  folderName: string = "DE-Quotation"
): Promise<DriveUploadResult> {
  let activeToken = accessToken;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      // 1. Get or create the parents folder
      const folderId = await getOrCreateAppFolder(activeToken, folderName);

      // 2. Build the multipart request body
      const boundary = "-------darshan_enterprises_boundary";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: fileName,
        mimeType: "application/pdf",
        parents: [folderId],
      };

      // Construct the multipart body as a Blob
      const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
      const mediaPartHeader = `${delimiter}Content-Type: application/pdf\r\n\r\n`;
      
      // We combine text metadata and binary media into a single blob
      const multipartBodyBlob = new Blob([
        metadataPart,
        mediaPartHeader,
        pdfBlob,
        closeDelimiter
      ], { type: `multipart/related; boundary=${boundary}` });

      // 3. Upload to Google Drive
      const uploadUrl = `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink`;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBodyBlob,
      });

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 401 && attempts < maxAttempts - 1) {
          attempts++;
          console.warn(`Drive API 401 caught inside uploadPdfToGoogleDrive. Retrying... (attempt ${attempts}/${maxAttempts})`);
          const renewedToken = await refreshAccessToken();
          if (renewedToken) {
            activeToken = renewedToken;
            continue; // Retry loop
          }
        }

        let errorMsg = `Status ${uploadResponse.status}`;
        try {
          const errJson = await uploadResponse.json();
          if (errJson.error && errJson.error.message) {
            errorMsg += `: ${errJson.error.message}`;
          }
        } catch {}

        if (uploadResponse.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("google_drive_access_token");
            window.dispatchEvent(new Event("google-session-expired"));
          }
          throw new Error("Your Google Drive access token has expired and could not be silently renewed. Please log in again.");
        }
        throw new Error(`Google Drive upload failed: ${errorMsg}`);
      }

      const uploadData = await uploadResponse.json();

      return {
        driveUrl: uploadData.webViewLink,
        driveFileId: uploadData.id,
      };
    } catch (error: any) {
      if (error.message && error.message.includes("expired") && attempts < maxAttempts - 1) {
        attempts++;
        const renewedToken = await refreshAccessToken();
        if (renewedToken) {
          activeToken = renewedToken;
          continue; // Retry
        }
      }
      console.error("Error uploading file to Google Drive:", error);
      throw error;
    }
  }

  throw new Error("Failed to upload PDF to Google Drive due to repeated authorization errors.");
}

/**
 * Deletes a file from Google Drive by its file ID.
 */
export async function deleteFileFromGoogleDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  let activeToken = accessToken;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      const url = `${DRIVE_FILES_URL}/${fileId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        if (response.status === 401 && attempts < maxAttempts - 1) {
          attempts++;
          console.warn(`Drive API 401 caught inside deleteFileFromGoogleDrive. Retrying... (attempt ${attempts}/${maxAttempts})`);
          const renewedToken = await refreshAccessToken();
          if (renewedToken) {
            activeToken = renewedToken;
            continue; // Retry
          }
        }

        let errorMsg = `Status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error && errJson.error.message) {
            errorMsg += `: ${errJson.error.message}`;
          }
        } catch {}

        if (response.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("google_drive_access_token");
            window.dispatchEvent(new Event("google-session-expired"));
          }
          throw new Error("Your Google Drive access token has expired and could not be silently renewed. Please log in again.");
        }
        throw new Error(`Google Drive delete failed: ${errorMsg}`);
      }

      return; // Success or 404
    } catch (error: any) {
      if (error.message && error.message.includes("expired") && attempts < maxAttempts - 1) {
        attempts++;
        const renewedToken = await refreshAccessToken();
        if (renewedToken) {
          activeToken = renewedToken;
          continue; // Retry
        }
      }
      console.error("Error deleting file from Google Drive:", error);
      throw error;
    }
  }

  throw new Error("Failed to delete file from Google Drive due to repeated authorization errors.");
}
