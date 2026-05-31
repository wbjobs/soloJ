package com.astro.fitsviewer.service;

import com.astro.fitsviewer.websocket.PsnrWebSocketHandler;
import nom.tam.fits.BasicHDU;
import nom.tam.fits.Fits;
import nom.tam.fits.ImageHDU;
import nom.tam.util.ArrayFuncs;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Array;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class PsnrService {

    private final PsnrWebSocketHandler wsHandler;

    public PsnrService(PsnrWebSocketHandler wsHandler) {
        this.wsHandler = wsHandler;
    }

    public String startPsnrTask(MultipartFile file1, MultipartFile file2, int hduIndex1, int hduIndex2) {
        String taskId = UUID.randomUUID().toString().substring(0, 8);
        computePsnrAsync(taskId, file1, file2, hduIndex1, hduIndex2);
        return taskId;
    }

    @Async
    public void computePsnrAsync(String taskId, MultipartFile file1, MultipartFile file2,
                                  int hduIndex1, int hduIndex2) {
        try {
            wsHandler.broadcastProgress(taskId, 0.0, "READING_FILE_1");

            double[][] data1 = readImageData(file1, hduIndex1);
            wsHandler.broadcastProgress(taskId, 25.0, "READING_FILE_2");

            double[][] data2 = readImageData(file2, hduIndex2);
            wsHandler.broadcastProgress(taskId, 50.0, "COMPUTING");

            int h1 = data1.length;
            int w1 = h1 > 0 ? data1[0].length : 0;
            int h2 = data2.length;
            int w2 = h2 > 0 ? data2[0].length : 0;

            int commonH = Math.min(h1, h2);
            int commonW = Math.min(w1, w2);

            if (commonH == 0 || commonW == 0) {
                wsHandler.broadcastResult(taskId, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY, "ERROR_EMPTY");
                return;
            }

            double mse = 0.0;
            int totalPixels = commonH * commonW;
            int progressStep = Math.max(1, commonH / 10);

            for (int y = 0; y < commonH; y++) {
                double[] row1 = data1[y];
                double[] row2 = data2[y];
                int safeW = Math.min(Math.min(row1.length, row2.length), commonW);
                for (int x = 0; x < safeW; x++) {
                    double diff = row1[x] - row2[x];
                    mse += diff * diff;
                }
                if (y % progressStep == 0 && y > 0) {
                    double progress = 50.0 + (30.0 * y / commonH);
                    wsHandler.broadcastProgress(taskId, progress, "COMPUTING");
                }
            }

            mse /= (double) totalPixels;
            wsHandler.broadcastProgress(taskId, 90.0, "FINALIZING");

            double psnr;
            if (mse == 0.0) {
                psnr = Double.POSITIVE_INFINITY;
            } else {
                double maxPixel = findMax(data1, commonH, commonW);
                double maxPixel2 = findMax(data2, commonH, commonW);
                double peak = Math.max(maxPixel, maxPixel2);
                if (peak == 0.0) peak = 1.0;
                psnr = 10.0 * Math.log10((peak * peak) / mse);
            }

            wsHandler.broadcastResult(taskId, psnr, mse, "COMPLETED");

        } catch (Exception e) {
            wsHandler.broadcastResult(taskId, Double.NEGATIVE_INFINITY, -1.0, "ERROR: " + e.getMessage());
        }
    }

    private double[][] readImageData(MultipartFile file, int hduIndex) throws Exception {
        Fits fits = null;
        try {
            fits = new Fits(new ByteArrayInputStream(file.getBytes()));
            BasicHDU<?>[] hduArray = fits.read();
            if (hduIndex < 0 || hduIndex >= hduArray.length) {
                throw new IllegalArgumentException("Invalid HDU index: " + hduIndex);
            }
            BasicHDU<?> hdu = hduArray[hduIndex];
            if (!(hdu instanceof ImageHDU)) {
                throw new IllegalArgumentException("HDU " + hduIndex + " is not an Image HDU");
            }
            ImageHDU imgHdu = (ImageHDU) hdu;
            Object dataKernel;
            try {
                dataKernel = imgHdu.getData().getData();
            } catch (ArrayIndexOutOfBoundsException e) {
                throw new IllegalArgumentException("Corrupted header in HDU " + hduIndex);
            }
            if (dataKernel == null) {
                throw new IllegalArgumentException("No image data in HDU " + hduIndex);
            }

            int[] dims = ArrayFuncs.getDimensions(dataKernel);
            if (dims == null || dims.length < 2) {
                throw new IllegalArgumentException("Unsupported image dimensionality");
            }
            int actualHeight = Array.getLength(dataKernel);
            int actualWidth = actualHeight > 0 ? Array.getLength(Array.get(dataKernel, 0)) : 0;
            int height = Math.min(dims[0], actualHeight);
            int width = Math.min(dims[1], actualWidth);

            if (dataKernel instanceof float[][]) {
                return safeConvert((float[][]) dataKernel, height, width);
            } else if (dataKernel instanceof double[][]) {
                return safeConvert((double[][]) dataKernel, height, width);
            } else if (dataKernel instanceof int[][]) {
                return safeConvert((int[][]) dataKernel, height, width);
            } else if (dataKernel instanceof short[][]) {
                return safeConvert((short[][]) dataKernel, height, width);
            } else if (dataKernel instanceof long[][]) {
                return safeConvert((long[][]) dataKernel, height, width);
            } else if (dataKernel instanceof byte[][]) {
                return safeConvert((byte[][]) dataKernel, height, width);
            } else if (dataKernel instanceof float[][][]) {
                return flatten3D((float[][][]) dataKernel, height, width);
            } else if (dataKernel instanceof double[][][]) {
                return flatten3D((double[][][]) dataKernel, height, width);
            } else {
                throw new IllegalArgumentException("Unsupported data type");
            }
        } finally {
            if (fits != null) {
                try { fits.close(); } catch (Exception e) { }
            }
        }
    }

    private double[][] safeConvert(float[][] arr, int h, int w) {
        int sh = Math.min(h, arr.length);
        double[][] r = new double[sh][];
        for (int i = 0; i < sh; i++) {
            float[] row = arr[i];
            int sw = Math.min(w, row != null ? row.length : 0);
            r[i] = new double[sw];
            for (int j = 0; j < sw; j++) r[i][j] = (double) row[j];
        }
        return r;
    }

    private double[][] safeConvert(double[][] arr, int h, int w) {
        int sh = Math.min(h, arr.length);
        double[][] r = new double[sh][];
        for (int i = 0; i < sh; i++) {
            double[] row = arr[i];
            int sw = Math.min(w, row != null ? row.length : 0);
            r[i] = new double[sw];
            for (int j = 0; j < sw; j++) r[i][j] = row[j];
        }
        return r;
    }

    private double[][] safeConvert(int[][] arr, int h, int w) {
        int sh = Math.min(h, arr.length);
        double[][] r = new double[sh][];
        for (int i = 0; i < sh; i++) {
            int[] row = arr[i];
            int sw = Math.min(w, row != null ? row.length : 0);
            r[i] = new double[sw];
            for (int j = 0; j < sw; j++) r[i][j] = (double) row[j];
        }
        return r;
    }

    private double[][] safeConvert(short[][] arr, int h, int w) {
        int sh = Math.min(h, arr.length);
        double[][] r = new double[sh][];
        for (int i = 0; i < sh; i++) {
            short[] row = arr[i];
            int sw = Math.min(w, row != null ? row.length : 0);
            r[i] = new double[sw];
            for (int j = 0; j < sw; j++) r[i][j] = (double) row[j];
        }
        return r;
    }

    private double[][] safeConvert(long[][] arr, int h, int w) {
        int sh = Math.min(h, arr.length);
        double[][] r = new double[sh][];
        for (int i = 0; i < sh; i++) {
            long[] row = arr[i];
            int sw = Math.min(w, row != null ? row.length : 0);
            r[i] = new double[sw];
            for (int j = 0; j < sw; j++) r[i][j] = (double) row[j];
        }
        return r;
    }

    private double[][] safeConvert(byte[][] arr, int h, int w) {
        int sh = Math.min(h, arr.length);
        double[][] r = new double[sh][];
        for (int i = 0; i < sh; i++) {
            byte[] row = arr[i];
            int sw = Math.min(w, row != null ? row.length : 0);
            r[i] = new double[sw];
            for (int j = 0; j < sw; j++) r[i][j] = (double) row[j];
        }
        return r;
    }

    private double[][] flatten3D(float[][][] arr, int h, int w) {
        if (arr.length == 0) return new double[0][0];
        int slice = Math.min(0, arr.length - 1);
        int sh = Math.min(h, arr[slice].length);
        double[][] r = new double[sh][];
        for (int y = 0; y < sh; y++) {
            float[] row = arr[slice][y];
            int sw = Math.min(w, row != null ? row.length : 0);
            r[y] = new double[sw];
            for (int x = 0; x < sw; x++) r[y][x] = (double) row[x];
        }
        return r;
    }

    private double[][] flatten3D(double[][][] arr, int h, int w) {
        if (arr.length == 0) return new double[0][0];
        int slice = Math.min(0, arr.length - 1);
        int sh = Math.min(h, arr[slice].length);
        double[][] r = new double[sh][];
        for (int y = 0; y < sh; y++) {
            double[] row = arr[slice][y];
            int sw = Math.min(w, row != null ? row.length : 0);
            r[y] = new double[sw];
            for (int x = 0; x < sw; x++) r[y][x] = row[x];
        }
        return r;
    }

    private double findMax(double[][] data, int h, int w) {
        double max = -Double.MAX_VALUE;
        for (int y = 0; y < h && y < data.length; y++) {
            double[] row = data[y];
            if (row == null) continue;
            for (int x = 0; x < w && x < row.length; x++) {
                if (row[x] > max && Double.isFinite(row[x])) max = row[x];
            }
        }
        return max;
    }
}
