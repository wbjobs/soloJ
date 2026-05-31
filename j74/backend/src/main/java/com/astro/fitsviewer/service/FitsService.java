package com.astro.fitsviewer.service;

import nom.tam.fits.BasicHDU;
import nom.tam.fits.BinaryTableHDU;
import nom.tam.fits.Fits;
import nom.tam.fits.HeaderCard;
import nom.tam.fits.ImageHDU;
import nom.tam.util.ArrayFuncs;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Array;
import java.util.*;

@Service
public class FitsService {

    public List<Map<String, Object>> readHeaders(MultipartFile file) throws Exception {
        List<Map<String, Object>> hdus = new ArrayList<Map<String, Object>>();
        Fits fits = null;
        try {
            fits = new Fits(new ByteArrayInputStream(file.getBytes()));
            BasicHDU<?>[] hduArray = fits.read();
            for (int i = 0; i < hduArray.length; i++) {
                BasicHDU<?> hdu = hduArray[i];
                if (hdu == null) continue;

                Map<String, Object> hduInfo = new LinkedHashMap<String, Object>();
                hduInfo.put("hduIndex", i);
                hduInfo.put("hduType", hdu.getClass().getSimpleName());

                Map<String, String> headerCards = new LinkedHashMap<String, String>();
                nom.tam.fits.Header header = hdu.getHeader();
                Iterator<HeaderCard> it = header.iterator();
                while (it.hasNext()) {
                    try {
                        HeaderCard card = it.next();
                        if (card == null) continue;
                        String key = card.getKey();
                        if (key != null && key.trim().length() > 0) {
                            String value = null;
                            try {
                                value = card.getValue();
                            } catch (Exception ve) {
                                try {
                                    value = card.getComment();
                                } catch (Exception ve2) {
                                    value = "";
                                }
                            }
                            headerCards.put(key, value != null ? value : "");
                        }
                    } catch (ArrayIndexOutOfBoundsException aioobe) {
                        break;
                    } catch (Exception ce) {
                        continue;
                    }
                }
                hduInfo.put("headers", headerCards);

                if (hdu instanceof ImageHDU) {
                    ImageHDU imgHdu = (ImageHDU) hdu;
                    try {
                        int[] axes = imgHdu.getAxes();
                        if (axes != null) {
                            hduInfo.put("nAxes", axes.length);
                            hduInfo.put("axes", axes);
                        } else {
                            hduInfo.put("nAxes", 0);
                            hduInfo.put("axes", new int[0]);
                        }
                    } catch (Exception e) {
                        hduInfo.put("nAxes", 0);
                        hduInfo.put("axes", new int[0]);
                    }
                    try {
                        hduInfo.put("bitpix", imgHdu.getBitPix());
                    } catch (Exception e) {
                        hduInfo.put("bitpix", 0);
                    }
                    hduInfo.put("imageType", "IMAGE");
                } else if (hdu instanceof BinaryTableHDU) {
                    BinaryTableHDU binTable = (BinaryTableHDU) hdu;
                    try {
                        hduInfo.put("nRows", binTable.getNRows());
                        hduInfo.put("nCols", binTable.getNCols());
                        int nCols = binTable.getNCols();
                        String[] colNames = new String[nCols];
                        for (int c = 0; c < nCols; c++) {
                            try {
                                colNames[c] = binTable.getColumnName(c);
                            } catch (Exception e) {
                                colNames[c] = "COL" + c;
                            }
                        }
                        hduInfo.put("colNames", colNames);
                    } catch (Exception e) {
                        hduInfo.put("nRows", 0);
                        hduInfo.put("nCols", 0);
                    }
                    hduInfo.put("imageType", "BINARY_TABLE");
                }

                hdus.add(hduInfo);
            }
        } finally {
            if (fits != null) {
                try { fits.close(); } catch (Exception e) { }
            }
        }
        return hdus;
    }

    public Map<String, Object> readImageData(MultipartFile file, int hduIndex) throws Exception {
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
                throw new IllegalArgumentException("Failed to read image data - corrupted header in HDU " + hduIndex);
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
            if (height <= 0 || width <= 0) {
                throw new IllegalArgumentException("Image has zero dimension in HDU " + hduIndex);
            }

            double[][] flatData;

            if (dataKernel instanceof float[][][]) {
                flatData = flatten2DSlice((float[][][]) dataKernel, height, width);
            } else if (dataKernel instanceof double[][][]) {
                flatData = flatten2DSlice((double[][][]) dataKernel, height, width);
            } else if (dataKernel instanceof int[][][]) {
                flatData = flatten2DSlice((int[][][]) dataKernel, height, width);
            } else if (dataKernel instanceof short[][][]) {
                flatData = flatten2DSlice((short[][][]) dataKernel, height, width);
            } else if (dataKernel instanceof float[][]) {
                flatData = safeConvertToDouble((float[][]) dataKernel, height, width);
            } else if (dataKernel instanceof double[][]) {
                flatData = safeConvertToDouble((double[][]) dataKernel, height, width);
            } else if (dataKernel instanceof int[][]) {
                flatData = safeConvertToDouble((int[][]) dataKernel, height, width);
            } else if (dataKernel instanceof short[][]) {
                flatData = safeConvertToDouble((short[][]) dataKernel, height, width);
            } else if (dataKernel instanceof long[][]) {
                flatData = safeConvertToDouble((long[][]) dataKernel, height, width);
            } else if (dataKernel instanceof byte[][]) {
                flatData = safeConvertToDouble((byte[][]) dataKernel, height, width);
            } else {
                throw new IllegalArgumentException("Unsupported data type: " + dataKernel.getClass().getSimpleName());
            }

            double min = Double.MAX_VALUE;
            double max = -Double.MAX_VALUE;
            for (int i = 0; i < flatData.length; i++) {
                double[] row = flatData[i];
                for (int j = 0; j < row.length; j++) {
                    double v = row[j];
                    if (isFinite(v)) {
                        if (v < min) min = v;
                        if (v > max) max = v;
                    }
                }
            }

            List<List<Double>> normalized = new ArrayList<List<Double>>();
            double range = max - min;
            if (range == 0) range = 1.0;

            for (int i = 0; i < flatData.length; i++) {
                double[] row = flatData[i];
                List<Double> normRow = new ArrayList<Double>();
                for (int j = 0; j < row.length; j++) {
                    double v = row[j];
                    normRow.add(isFinite(v) ? (v - min) / range : 0.0);
                }
                normalized.add(normRow);
            }

            Map<String, Object> result = new LinkedHashMap<String, Object>();
            result.put("width", width);
            result.put("height", height);
            result.put("min", min);
            result.put("max", max);
            result.put("data", normalized);
            return result;
        } finally {
            if (fits != null) {
                try { fits.close(); } catch (Exception e) { }
            }
        }
    }

    public Map<String, Object> readSpectrumData(MultipartFile file, int hduIndex) throws Exception {
        Fits fits = null;
        try {
            fits = new Fits(new ByteArrayInputStream(file.getBytes()));
            BasicHDU<?>[] hduArray = fits.read();
            if (hduIndex < 0 || hduIndex >= hduArray.length) {
                throw new IllegalArgumentException("Invalid HDU index: " + hduIndex);
            }

            BasicHDU<?> hdu = hduArray[hduIndex];

            if (hdu instanceof BinaryTableHDU) {
                return extractSpectrumFromTable((BinaryTableHDU) hdu);
            } else if (hdu instanceof ImageHDU) {
                return extractSpectrumFromImage((ImageHDU) hdu);
            }

            throw new IllegalArgumentException("HDU " + hduIndex + " is not a supported type for spectrum extraction");
        } finally {
            if (fits != null) {
                try { fits.close(); } catch (Exception e) { }
            }
        }
    }

    private Map<String, Object> extractSpectrumFromTable(BinaryTableHDU binTable) throws Exception {
        int nCols;
        int nRows;
        try {
            nCols = binTable.getNCols();
            nRows = binTable.getNRows();
        } catch (Exception e) {
            Map<String, Object> result = new LinkedHashMap<String, Object>();
            result.put("wavelengths", new ArrayList<Double>());
            result.put("fluxes", new ArrayList<Double>());
            result.put("colNames", new String[0]);
            return result;
        }

        String[] colNames = new String[nCols];
        for (int c = 0; c < nCols; c++) {
            try {
                colNames[c] = binTable.getColumnName(c);
            } catch (Exception e) {
                colNames[c] = "COL" + c;
            }
        }

        int waveCol = findColumn(colNames, new String[]{"WAVELENGTH", "WAVE", "LAMBDA", "WAVELNTH", "CRVAL1"});
        int fluxCol = findColumn(colNames, new String[]{"FLUX", "COUNTS", "INTENSITY", "DATA", "SPECTRUM"});

        List<Double> wavelengths = new ArrayList<Double>();
        List<Double> fluxes = new ArrayList<Double>();

        if (waveCol >= 0 && fluxCol >= 0) {
            for (int r = 0; r < nRows; r++) {
                try {
                    Object row = binTable.getRow(r);
                    Object[] rowArr = safeRowToArray(row, nCols);
                    wavelengths.add(toDouble(rowArr[waveCol]));
                    fluxes.add(toDouble(rowArr[fluxCol]));
                } catch (ArrayIndexOutOfBoundsException e) {
                    break;
                } catch (Exception e) {
                    continue;
                }
            }
        } else {
            int firstNumericCol = -1;
            for (int c = 0; c < nCols; c++) {
                try {
                    Object colData = binTable.getColumn(c);
                    if (colData != null && colData.getClass().isArray()) {
                        firstNumericCol = c;
                        break;
                    }
                } catch (Exception e) {
                    continue;
                }
            }
            if (firstNumericCol >= 0) {
                try {
                    Object colData = binTable.getColumn(firstNumericCol);
                    int colLen = Array.getLength(colData);
                    for (int r = 0; r < colLen; r++) {
                        wavelengths.add((double) r);
                        fluxes.add(toDouble(Array.get(colData, r)));
                    }
                } catch (Exception e) {
                    for (int r = 0; r < nRows; r++) {
                        wavelengths.add((double) r);
                        fluxes.add(0.0);
                    }
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("wavelengths", wavelengths);
        result.put("fluxes", fluxes);
        result.put("colNames", colNames);
        return result;
    }

    private Object[] safeRowToArray(Object row, int expectedCols) {
        if (row instanceof Object[]) {
            return (Object[]) row;
        }
        if (row != null && row.getClass().isArray()) {
            int len = Math.min(Array.getLength(row), expectedCols);
            Object[] result = new Object[len];
            for (int i = 0; i < len; i++) {
                result[i] = Array.get(row, i);
            }
            return result;
        }
        return new Object[0];
    }

    private Map<String, Object> extractSpectrumFromImage(ImageHDU imgHdu) throws Exception {
        nom.tam.fits.Header header = imgHdu.getHeader();
        double crval1 = getDoubleHeader(header, "CRVAL1", 0.0);
        double cdelt1 = getDoubleHeader(header, "CDELT1", 1.0);
        double crpix1 = getDoubleHeader(header, "CRPIX1", 1.0);
        String ctype1 = getStringHeader(header, "CTYPE1", "");
        String cunit1 = getStringHeader(header, "CUNIT1", "");

        Object dataKernel;
        try {
            dataKernel = imgHdu.getData().getData();
        } catch (ArrayIndexOutOfBoundsException e) {
            Map<String, Object> result = new LinkedHashMap<String, Object>();
            result.put("wavelengths", new ArrayList<Double>());
            result.put("fluxes", new ArrayList<Double>());
            result.put("ctype1", ctype1);
            result.put("cunit1", cunit1);
            result.put("crval1", crval1);
            result.put("cdelt1", cdelt1);
            return result;
        }

        List<Double> wavelengths = new ArrayList<Double>();
        List<Double> fluxes = new ArrayList<Double>();

        if (dataKernel instanceof float[][]) {
            safeExtract1DSpectrum((float[][]) dataKernel, crval1, cdelt1, crpix1, wavelengths, fluxes);
        } else if (dataKernel instanceof double[][]) {
            safeExtract1DSpectrum((double[][]) dataKernel, crval1, cdelt1, crpix1, wavelengths, fluxes);
        } else if (dataKernel instanceof int[][]) {
            safeExtract1DSpectrum((int[][]) dataKernel, crval1, cdelt1, crpix1, wavelengths, fluxes);
        } else if (dataKernel instanceof short[][]) {
            safeExtract1DSpectrum((short[][]) dataKernel, crval1, cdelt1, crpix1, wavelengths, fluxes);
        } else if (dataKernel instanceof float[]) {
            float[] arr = (float[]) dataKernel;
            for (int i = 0; i < arr.length; i++) {
                wavelengths.add(crval1 + (i + 1 - crpix1) * cdelt1);
                fluxes.add((double) arr[i]);
            }
        } else if (dataKernel instanceof double[]) {
            double[] arr = (double[]) dataKernel;
            for (int i = 0; i < arr.length; i++) {
                wavelengths.add(crval1 + (i + 1 - crpix1) * cdelt1);
                fluxes.add(arr[i]);
            }
        }

        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("wavelengths", wavelengths);
        result.put("fluxes", fluxes);
        result.put("ctype1", ctype1);
        result.put("cunit1", cunit1);
        result.put("crval1", crval1);
        result.put("cdelt1", cdelt1);
        return result;
    }

    private void safeExtract1DSpectrum(float[][] arr, double crval1, double cdelt1, double crpix1,
                                        List<Double> wavelengths, List<Double> fluxes) {
        int len = arr.length;
        for (int i = 0; i < len; i++) {
            wavelengths.add(crval1 + (i + 1 - crpix1) * cdelt1);
            float[] row = arr[i];
            if (row == null) {
                fluxes.add(0.0);
                continue;
            }
            double sum = 0;
            int count = 0;
            for (int j = 0; j < row.length; j++) {
                double d = (double) row[j];
                if (isFinite(d)) {
                    sum += d;
                    count++;
                }
            }
            fluxes.add(count > 0 ? sum / count : 0.0);
        }
    }

    private void safeExtract1DSpectrum(double[][] arr, double crval1, double cdelt1, double crpix1,
                                        List<Double> wavelengths, List<Double> fluxes) {
        int len = arr.length;
        for (int i = 0; i < len; i++) {
            wavelengths.add(crval1 + (i + 1 - crpix1) * cdelt1);
            double[] row = arr[i];
            if (row == null) {
                fluxes.add(0.0);
                continue;
            }
            double sum = 0;
            int count = 0;
            for (int j = 0; j < row.length; j++) {
                double d = row[j];
                if (isFinite(d)) {
                    sum += d;
                    count++;
                }
            }
            fluxes.add(count > 0 ? sum / count : 0.0);
        }
    }

    private void safeExtract1DSpectrum(int[][] arr, double crval1, double cdelt1, double crpix1,
                                        List<Double> wavelengths, List<Double> fluxes) {
        int len = arr.length;
        for (int i = 0; i < len; i++) {
            wavelengths.add(crval1 + (i + 1 - crpix1) * cdelt1);
            int[] row = arr[i];
            if (row == null) {
                fluxes.add(0.0);
                continue;
            }
            double sum = 0;
            int count = 0;
            for (int j = 0; j < row.length; j++) {
                double d = (double) row[j];
                if (isFinite(d)) {
                    sum += d;
                    count++;
                }
            }
            fluxes.add(count > 0 ? sum / count : 0.0);
        }
    }

    private void safeExtract1DSpectrum(short[][] arr, double crval1, double cdelt1, double crpix1,
                                        List<Double> wavelengths, List<Double> fluxes) {
        int len = arr.length;
        for (int i = 0; i < len; i++) {
            wavelengths.add(crval1 + (i + 1 - crpix1) * cdelt1);
            short[] row = arr[i];
            if (row == null) {
                fluxes.add(0.0);
                continue;
            }
            double sum = 0;
            int count = 0;
            for (int j = 0; j < row.length; j++) {
                double d = (double) row[j];
                if (isFinite(d)) {
                    sum += d;
                    count++;
                }
            }
            fluxes.add(count > 0 ? sum / count : 0.0);
        }
    }

    private double[][] safeConvertToDouble(float[][] arr, int height, int width) {
        int safeH = Math.min(height, arr.length);
        double[][] result = new double[safeH][];
        for (int i = 0; i < safeH; i++) {
            float[] row = arr[i];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[i] = new double[safeW];
            for (int j = 0; j < safeW; j++) {
                result[i][j] = (double) row[j];
            }
        }
        return result;
    }

    private double[][] safeConvertToDouble(double[][] arr, int height, int width) {
        int safeH = Math.min(height, arr.length);
        double[][] result = new double[safeH][];
        for (int i = 0; i < safeH; i++) {
            double[] row = arr[i];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[i] = new double[safeW];
            for (int j = 0; j < safeW; j++) {
                result[i][j] = row[j];
            }
        }
        return result;
    }

    private double[][] safeConvertToDouble(int[][] arr, int height, int width) {
        int safeH = Math.min(height, arr.length);
        double[][] result = new double[safeH][];
        for (int i = 0; i < safeH; i++) {
            int[] row = arr[i];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[i] = new double[safeW];
            for (int j = 0; j < safeW; j++) {
                result[i][j] = (double) row[j];
            }
        }
        return result;
    }

    private double[][] safeConvertToDouble(short[][] arr, int height, int width) {
        int safeH = Math.min(height, arr.length);
        double[][] result = new double[safeH][];
        for (int i = 0; i < safeH; i++) {
            short[] row = arr[i];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[i] = new double[safeW];
            for (int j = 0; j < safeW; j++) {
                result[i][j] = (double) row[j];
            }
        }
        return result;
    }

    private double[][] safeConvertToDouble(long[][] arr, int height, int width) {
        int safeH = Math.min(height, arr.length);
        double[][] result = new double[safeH][];
        for (int i = 0; i < safeH; i++) {
            long[] row = arr[i];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[i] = new double[safeW];
            for (int j = 0; j < safeW; j++) {
                result[i][j] = (double) row[j];
            }
        }
        return result;
    }

    private double[][] safeConvertToDouble(byte[][] arr, int height, int width) {
        int safeH = Math.min(height, arr.length);
        double[][] result = new double[safeH][];
        for (int i = 0; i < safeH; i++) {
            byte[] row = arr[i];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[i] = new double[safeW];
            for (int j = 0; j < safeW; j++) {
                result[i][j] = (double) row[j];
            }
        }
        return result;
    }

    private double[][] flatten2DSlice(float[][][] arr3d, int height, int width) {
        if (arr3d.length == 0) return new double[0][0];
        int safeSlice = Math.min(1, arr3d.length - 1);
        int safeH = Math.min(height, arr3d[safeSlice].length);
        double[][] result = new double[safeH][];
        for (int y = 0; y < safeH; y++) {
            float[] row = arr3d[safeSlice][y];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[y] = new double[safeW];
            for (int x = 0; x < safeW; x++) {
                result[y][x] = (double) row[x];
            }
        }
        return result;
    }

    private double[][] flatten2DSlice(double[][][] arr3d, int height, int width) {
        if (arr3d.length == 0) return new double[0][0];
        int safeSlice = Math.min(1, arr3d.length - 1);
        int safeH = Math.min(height, arr3d[safeSlice].length);
        double[][] result = new double[safeH][];
        for (int y = 0; y < safeH; y++) {
            double[] row = arr3d[safeSlice][y];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[y] = new double[safeW];
            for (int x = 0; x < safeW; x++) {
                result[y][x] = row[x];
            }
        }
        return result;
    }

    private double[][] flatten2DSlice(int[][][] arr3d, int height, int width) {
        if (arr3d.length == 0) return new double[0][0];
        int safeSlice = Math.min(1, arr3d.length - 1);
        int safeH = Math.min(height, arr3d[safeSlice].length);
        double[][] result = new double[safeH][];
        for (int y = 0; y < safeH; y++) {
            int[] row = arr3d[safeSlice][y];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[y] = new double[safeW];
            for (int x = 0; x < safeW; x++) {
                result[y][x] = (double) row[x];
            }
        }
        return result;
    }

    private double[][] flatten2DSlice(short[][][] arr3d, int height, int width) {
        if (arr3d.length == 0) return new double[0][0];
        int safeSlice = Math.min(1, arr3d.length - 1);
        int safeH = Math.min(height, arr3d[safeSlice].length);
        double[][] result = new double[safeH][];
        for (int y = 0; y < safeH; y++) {
            short[] row = arr3d[safeSlice][y];
            int safeW = Math.min(width, row != null ? row.length : 0);
            result[y] = new double[safeW];
            for (int x = 0; x < safeW; x++) {
                result[y][x] = (double) row[x];
            }
        }
        return result;
    }

    private double toDouble(Object val) {
        if (val instanceof Number) {
            return ((Number) val).doubleValue();
        }
        if (val != null && val.getClass().isArray()) {
            try {
                int len = Array.getLength(val);
                if (len > 0) return toDouble(Array.get(val, 0));
            } catch (Exception e) {
                return 0.0;
            }
        }
        return 0.0;
    }

    private boolean isFinite(double d) {
        return !Double.isInfinite(d) && !Double.isNaN(d);
    }

    private int findColumn(String[] colNames, String[] candidates) {
        for (String candidate : candidates) {
            for (int i = 0; i < colNames.length; i++) {
                if (colNames[i] != null && colNames[i].toUpperCase().contains(candidate.toUpperCase())) {
                    return i;
                }
            }
        }
        return -1;
    }

    private double getDoubleHeader(nom.tam.fits.Header header, String key, double def) {
        try {
            HeaderCard card = header.findCard(key);
            if (card == null) return def;
            String val = card.getValue();
            if (val == null) return def;
            return Double.parseDouble(val.trim());
        } catch (Exception e) {
            return def;
        }
    }

    private String getStringHeader(nom.tam.fits.Header header, String key, String def) {
        try {
            HeaderCard card = header.findCard(key);
            if (card == null) return def;
            String val = card.getValue();
            return val != null ? val : def;
        } catch (Exception e) {
            return def;
        }
    }
}
