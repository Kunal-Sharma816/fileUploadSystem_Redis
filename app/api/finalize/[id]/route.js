// app/api/finalize/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Dataset from "@/app/models/Dataset"

export async function POST(request, { params }) {
  try {
    await connectDB();

    const { id } = params;

    const dataset = await Dataset.findById(id);

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    if (dataset.status === 'expired') {
      return NextResponse.json(
        { error: 'Dataset has already expired' },
        { status: 410 }
      );
    }

    if (dataset.status === 'finalized') {
      return NextResponse.json(
        { message: 'Dataset is already finalized' },
        { status: 200 }
      );
    }

    // Update status to finalized
    dataset.status = 'finalized';
    dataset.finalizedAt = new Date();
    dataset.expiresAt = null; // Remove expiration for finalized datasets
    await dataset.save();

    return NextResponse.json({
      success: true,
      message: 'Dataset finalized successfully',
      dataset: {
        id: dataset._id,
        status: dataset.status,
        finalizedAt: dataset.finalizedAt
      }
    });

  } catch (error) {
    console.error('Finalize error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize dataset', details: error.message },
      { status: 500 }
    );
  }
}