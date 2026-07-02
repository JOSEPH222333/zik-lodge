import { v2 as cloudinary } from "cloudinary";
import type { Express } from "express";

type UploadFolder = "agent-documents" | "lodge-images" | "profile-images";

// Cloudinary is optional in development; missing credentials produce stable placeholder URLs.
function cloudinaryReady() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// Uploads buffered Multer files and returns a URL shape the frontend can render.
export async function uploadBuffer(file: Express.Multer.File, folder: UploadFolder) {
  if (!cloudinaryReady()) {
    return {
      url: `https://storage.example.com/${folder}/${encodeURIComponent(file.originalname)}`,
      publicId: undefined,
      devFallback: true
    };
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `zik-lodge/${folder}`,
    resource_type: file.mimetype === "application/pdf" ? "raw" : "image"
  });

  return { url: result.secure_url, publicId: result.public_id, devFallback: false };
}
