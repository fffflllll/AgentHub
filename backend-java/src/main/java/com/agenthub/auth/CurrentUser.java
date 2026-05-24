package com.agenthub.auth;

public final class CurrentUser {
  private static final ThreadLocal<String> USER_ID = new ThreadLocal<>();

  private CurrentUser() {}

  public static String get() {
    return USER_ID.get();
  }

  public static void set(String userId) {
    USER_ID.set(userId);
  }

  public static void clear() {
    USER_ID.remove();
  }
}
