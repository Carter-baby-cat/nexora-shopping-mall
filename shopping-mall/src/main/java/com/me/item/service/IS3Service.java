package com.me.item.service;

import org.springframework.web.multipart.MultipartFile;

public interface IS3Service {

    String upload(MultipartFile file);
}