package com.alchemyx.erp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enables the daily billing and overdue-reminder jobs. */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
