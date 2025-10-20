import { NextResponse } from "next/server";
import { redisHelpers } from "@/lib/redis";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');

    if (!uploadId) {
      return NextResponse.json(
        { error: "Missing uploadId" },
        { status: 400 }
      );
    }

    const progress = await redisHelpers.getUploadProgress(uploadId);
    
    if (!progress) {
      return NextResponse.json(
        { error: "Upload not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      progress
    });

  } catch (error) {
    console.error("Progress fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}