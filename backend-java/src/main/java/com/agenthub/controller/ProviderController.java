package com.agenthub.controller;

import com.agenthub.common.ApiResponse;
import com.agenthub.dto.request.CreateProviderRequest;
import com.agenthub.dto.request.UpdateProviderRequest;
import com.agenthub.dto.response.ProviderResponse;
import com.agenthub.service.ProviderService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/providers")
public class ProviderController {
  private final ProviderService providerService;

  public ProviderController(ProviderService providerService) {
    this.providerService = providerService;
  }

  @GetMapping
  public ApiResponse<List<ProviderResponse>> listProviders() {
    return ApiResponse.success(providerService.listCurrentUserProviders());
  }

  @PostMapping
  public ApiResponse<ProviderResponse> createProvider(@Valid @RequestBody CreateProviderRequest request) {
    return ApiResponse.success(providerService.createProvider(request));
  }

  @PutMapping("/{id}")
  public ApiResponse<ProviderResponse> updateProvider(
      @PathVariable String id,
      @Valid @RequestBody UpdateProviderRequest request) {
    return ApiResponse.success(providerService.updateProvider(id, request));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteProvider(@PathVariable String id) {
    providerService.deleteProvider(id);
    return ResponseEntity.noContent().build();
  }
}
