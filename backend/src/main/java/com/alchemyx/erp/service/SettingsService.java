package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.CompanyDto;
import com.alchemyx.erp.api.Dtos.InvoicingDto;
import com.alchemyx.erp.api.Dtos.NotificationsDto;
import com.alchemyx.erp.api.Dtos.SettingsDto;
import com.alchemyx.erp.api.Dtos.SettingsRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.ServiceCategory;
import com.alchemyx.erp.model.WorkspaceSettings;
import com.alchemyx.erp.repository.ServiceCategoryRepository;
import com.alchemyx.erp.repository.WorkspaceSettingsRepository;
import com.alchemyx.erp.util.Validation;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    private static final List<String> CURRENCIES = List.of("LKR", "USD", "EUR");
    private static final List<String> FISCAL_STARTS = List.of("July", "January", "April");
    private static final List<String> TEMPLATES = List.of("Modern", "Classic", "Minimal");

    private final WorkspaceSettingsRepository settings;
    private final ServiceCategoryRepository categories;
    private final AuditService audit;

    public SettingsService(WorkspaceSettingsRepository settings, ServiceCategoryRepository categories, AuditService audit) {
        this.settings = settings;
        this.categories = categories;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public SettingsDto get() {
        WorkspaceSettings s = current();
        return new SettingsDto(
                new CompanyDto(s.getCompanyName(), s.getRegistrationNo(), s.getBillingEmail(), s.getRegisteredAddress()),
                s.getDefaultCurrency(),
                s.getFiscalYearStart(),
                s.getOpeningCash(),
                new InvoicingDto(s.getInvoicePrefix(), s.getInvoiceNextNumber(), s.getInvoiceTemplate(),
                        s.getPaymentTerms(), s.getTaxLabel()),
                new NotificationsDto(s.isNotifyOverdue(), s.isNotifyNewOrder(), s.isNotifyLeave(),
                        s.isNotifyDeadline(), s.isNotifyWeekly()),
                categories.findAllByOrderByPositionAscNameAsc().stream().map(ServiceCategory::getName).toList());
    }

    @Transactional
    public void update(Member actor, SettingsRequest req) {
        Permissions.require(Permissions.admin(actor.getRole()), "Only a Super Admin can change workspace settings.");
        WorkspaceSettings s = current();
        if (req.companyName() != null) s.setCompanyName(req.companyName().trim());
        if (req.registrationNo() != null) s.setRegistrationNo(req.registrationNo().trim());
        if (req.billingEmail() != null) s.setBillingEmail(req.billingEmail().isBlank() ? "" : Validation.email(req.billingEmail()));
        if (req.registeredAddress() != null) s.setRegisteredAddress(req.registeredAddress().trim());
        if (req.currency() != null) s.setDefaultCurrency(Validation.oneOf(req.currency(), "Currency", CURRENCIES));
        if (req.fiscalYearStart() != null) s.setFiscalYearStart(Validation.oneOf(req.fiscalYearStart(), "Fiscal year start", FISCAL_STARTS));
        if (req.openingCash() != null) s.setOpeningCash(req.openingCash().setScale(2));
        if (req.invoicePrefix() != null) {
            s.setInvoicePrefix(Validation.required(req.invoicePrefix(), "Invoice prefix"));
        }
        if (req.invoiceNextNumber() != null) {
            if (req.invoiceNextNumber() < 1) {
                throw ApiException.badRequest("Next invoice number must be at least 1");
            }
            s.setInvoiceNextNumber(req.invoiceNextNumber());
        }
        if (req.invoiceTemplate() != null) s.setInvoiceTemplate(Validation.oneOf(req.invoiceTemplate(), "Template", TEMPLATES));
        if (req.paymentTerms() != null) s.setPaymentTerms(req.paymentTerms().trim());
        if (req.taxLabel() != null) s.setTaxLabel(req.taxLabel().trim());
        if (req.notifyOverdue() != null) s.setNotifyOverdue(req.notifyOverdue());
        if (req.notifyNewOrder() != null) s.setNotifyNewOrder(req.notifyNewOrder());
        if (req.notifyLeave() != null) s.setNotifyLeave(req.notifyLeave());
        if (req.notifyDeadline() != null) s.setNotifyDeadline(req.notifyDeadline());
        if (req.notifyWeekly() != null) s.setNotifyWeekly(req.notifyWeekly());
        audit.record(actor, "Updated workspace settings");
    }

    @Transactional
    public void replaceServices(Member actor, List<String> names) {
        Permissions.require(Permissions.admin(actor.getRole()), "Only a Super Admin can change service categories.");
        if (names == null) {
            throw ApiException.badRequest("Services are required");
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String n : names) {
            if (n != null && !n.isBlank()) {
                unique.add(n.trim());
            }
        }
        if (unique.isEmpty()) {
            throw ApiException.badRequest("At least one service category is required");
        }
        categories.deleteAll();
        categories.flush();
        int position = 1;
        for (String n : unique) {
            categories.save(new ServiceCategory(n, position++));
        }
        audit.record(actor, "Updated service categories");
    }

    /** Opening cash and currency are read by analytics and the UI. */
    @Transactional(readOnly = true)
    public BigDecimal openingCash() {
        return current().getOpeningCash();
    }

    @Transactional(readOnly = true)
    public WorkspaceSettings current() {
        return settings.findById(1).orElseThrow(() -> new IllegalStateException("workspace_settings row is missing"));
    }
}
