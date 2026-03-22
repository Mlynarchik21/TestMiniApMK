<section style={{ ...styles.topRow, ...reveal(0, mounted) }}>
  <div style={styles.topRightStack}>
    <div style={styles.updatedAt}>Обновлено: {updatedAt}</div>

    <div style={styles.topActions}>
      <button
        type="button"
        aria-label="Уведомления"
        style={styles.iconButton}
        onClick={() => router.replace("/notifications")}
      >
        <BellIcon />
      </button>

      <button
        type="button"
        aria-label="Поддержка"
        style={styles.iconButton}
        onClick={() => router.replace("/support")}
      >
        <ChatIcon />
      </button>

      <button
        type="button"
        aria-label="Настройки"
        style={styles.iconButton}
        onClick={() => router.replace("/settings")}
      >
        <SettingsIcon />
      </button>
    </div>
  </div>
</section>