package com.agenthub.service;

import com.agenthub.auth.CurrentUser;
import com.agenthub.common.BusinessException;
import com.agenthub.dto.request.CreateProviderRequest;
import com.agenthub.dto.request.UpdateProviderRequest;
import com.agenthub.dto.response.ProviderResponse;
import com.agenthub.mapper.UserProviderMapper;
import com.agenthub.model.UserProvider;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProviderService {
  private static final int PROVIDER_NOT_FOUND_CODE = 40401;
  private static final int PROVIDER_INVALID_CODE = 40002;
  private static final Set<String> SUPPORTED_TYPES = Set.of("OPENAI", "ANTHROPIC", "CUSTOM");

  private final UserProviderMapper providerMapper;
  private final AesGcmSecretCodec secretCodec;

  public ProviderService(UserProviderMapper providerMapper, AesGcmSecretCodec secretCodec) {
    this.providerMapper = providerMapper;
    this.secretCodec = secretCodec;
  }

  public List<ProviderResponse> listCurrentUserProviders() {
    String userId = requireCurrentUser();
    return providerMapper.findByUserId(userId).stream()
        .map(ProviderResponse::from)
        .toList();
  }

  @Transactional
  public ProviderResponse createProvider(CreateProviderRequest request) {
    String userId = requireCurrentUser();
    boolean defaultProvider = Boolean.TRUE.equals(request.isDefault()) || providerMapper.countByUserId(userId) == 0;

    if (defaultProvider) {
      providerMapper.clearDefaults(userId);
    }

    UserProvider provider = new UserProvider();
    provider.setId(UUID.randomUUID().toString());
    provider.setUserId(userId);
    provider.setProviderType(normalizeProviderType(request.providerType()));
    provider.setApiKeyEnc(secretCodec.encrypt(requireText(request.apiKey(), "apiKey")));
    provider.setBaseUrl(normalizeOptionalText(request.baseUrl()));
    provider.setDefaultModel(requireText(request.defaultModel(), "defaultModel"));
    provider.setDefaultProvider(defaultProvider);
    providerMapper.insert(provider);

    return ProviderResponse.from(requireProvider(provider.getId(), userId));
  }

  @Transactional
  public ProviderResponse updateProvider(String id, UpdateProviderRequest request) {
    String userId = requireCurrentUser();
    UserProvider provider = requireProvider(id, userId);

    if (request.providerType() != null) {
      provider.setProviderType(normalizeProviderType(request.providerType()));
    }

    if (request.apiKey() != null && !request.apiKey().isBlank()) {
      provider.setApiKeyEnc(secretCodec.encrypt(request.apiKey().trim()));
    }

    if (request.baseUrl() != null) {
      provider.setBaseUrl(normalizeOptionalText(request.baseUrl()));
    }

    if (request.defaultModel() != null) {
      provider.setDefaultModel(requireText(request.defaultModel(), "defaultModel"));
    }

    if (Boolean.TRUE.equals(request.isDefault())) {
      providerMapper.clearDefaults(userId);
      provider.setDefaultProvider(true);
    } else if (Boolean.FALSE.equals(request.isDefault())) {
      provider.setDefaultProvider(false);
    }

    providerMapper.update(provider);
    return ProviderResponse.from(requireProvider(id, userId));
  }

  @Transactional
  public void deleteProvider(String id) {
    String userId = requireCurrentUser();
    UserProvider provider = requireProvider(id, userId);
    providerMapper.deleteByIdAndUserId(id, userId);

    if (provider.isDefaultProvider()) {
      UserProvider replacement = providerMapper.findFirstByUserId(userId);
      if (replacement != null) {
        providerMapper.markDefault(replacement.getId(), userId);
      }
    }
  }

  private UserProvider requireProvider(String id, String userId) {
    UserProvider provider = providerMapper.findByIdAndUserId(id, userId);
    if (provider == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, PROVIDER_NOT_FOUND_CODE, "provider not found");
    }

    return provider;
  }

  private String normalizeProviderType(String value) {
    String providerType = requireText(value, "providerType").toUpperCase(Locale.ROOT);
    if (!SUPPORTED_TYPES.contains(providerType)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, PROVIDER_INVALID_CODE, "unsupported provider type");
    }

    return providerType;
  }

  private String requireText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, PROVIDER_INVALID_CODE, fieldName + " is required");
    }

    return value.trim();
  }

  private String normalizeOptionalText(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }

    return value.trim();
  }

  private String requireCurrentUser() {
    String userId = CurrentUser.get();
    if (userId == null || userId.isBlank()) {
      throw new BusinessException(HttpStatus.UNAUTHORIZED, 401, "unauthorized");
    }

    return userId;
  }
}
