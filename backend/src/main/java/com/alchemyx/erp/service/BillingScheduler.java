package com.alchemyx.erp.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily jobs that run without a signed-in user. Schedules come from app.billing-cron and app.overdue-cron.
 * Each job is idempotent: a subscription's billing date only moves forward when it is billed.
 */
@Component
public class BillingScheduler {

    private static final Logger log = LoggerFactory.getLogger(BillingScheduler.class);

    private final SubscriptionService subscriptions;
    private final InvoiceDeliveryService delivery;

    public BillingScheduler(SubscriptionService subscriptions, InvoiceDeliveryService delivery) {
        this.subscriptions = subscriptions;
        this.delivery = delivery;
    }

    @Scheduled(cron = "${app.billing-cron:0 0 6 * * *}", zone = "${app.timezone:Asia/Colombo}")
    public void billDueSubscriptions() {
        int drafted = subscriptions.billDueAsSystem();
        if (drafted > 0) {
            log.info("Daily billing drafted {} invoice(s)", drafted);
        }
    }

    @Scheduled(cron = "${app.overdue-cron:0 0 7 * * *}", zone = "${app.timezone:Asia/Colombo}")
    public void overdueReminders() {
        delivery.sendOverdueReminders();
    }
}
