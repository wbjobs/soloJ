package com.astro.fitsviewer.controller;

import com.astro.fitsviewer.service.FitsService;
import com.astro.fitsviewer.service.PsnrService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/fits")
public class FitsController {

    private final FitsService fitsService;
    private final PsnrService psnrService;

    public FitsController(FitsService fitsService, PsnrService psnrService) {
        this.fitsService = fitsService;
        this.psnrService = psnrService;
    }

    @PostMapping("/headers")
    public ResponseEntity<List<Map<String, Object>>> readHeaders(@RequestParam("file") MultipartFile file) {
        try {
            List<Map<String, Object>> headers = fitsService.readHeaders(file);
            return ResponseEntity.ok(headers);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/image")
    public ResponseEntity<Map<String, Object>> readImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "hduIndex", defaultValue = "0") int hduIndex) {
        try {
            Map<String, Object> imageData = fitsService.readImageData(file, hduIndex);
            return ResponseEntity.ok(imageData);
        } catch (IllegalArgumentException e) {
            Map<String, Object> body = new HashMap<String, Object>();
            body.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(body);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/spectrum")
    public ResponseEntity<Map<String, Object>> readSpectrum(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "hduIndex", defaultValue = "1") int hduIndex) {
        try {
            Map<String, Object> spectrumData = fitsService.readSpectrumData(file, hduIndex);
            return ResponseEntity.ok(spectrumData);
        } catch (IllegalArgumentException e) {
            Map<String, Object> body = new HashMap<String, Object>();
            body.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(body);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/compare")
    public ResponseEntity<Map<String, Object>> compareImages(
            @RequestParam("file1") MultipartFile file1,
            @RequestParam("file2") MultipartFile file2,
            @RequestParam(value = "hduIndex1", defaultValue = "0") int hduIndex1,
            @RequestParam(value = "hduIndex2", defaultValue = "0") int hduIndex2) {
        try {
            String taskId = psnrService.startPsnrTask(file1, file2, hduIndex1, hduIndex2);
            Map<String, Object> body = new HashMap<String, Object>();
            body.put("taskId", taskId);
            body.put("status", "STARTED");
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            Map<String, Object> body = new HashMap<String, Object>();
            body.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
        }
    }
}
