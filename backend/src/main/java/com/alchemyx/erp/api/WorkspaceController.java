package com.alchemyx.erp.api;

import com.alchemyx.erp.api.Dtos.FinanceAnalyticsDto;
import com.alchemyx.erp.api.Dtos.WorkspaceDto;
import com.alchemyx.erp.model.Entities.Member;
import com.alchemyx.erp.service.AnalyticsService;
import com.alchemyx.erp.service.WorkspaceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class WorkspaceController {

    private final WorkspaceService workspace;
    private final AnalyticsService analytics;

    public WorkspaceController(WorkspaceService workspace, AnalyticsService analytics) {
        this.workspace = workspace;
        this.analytics = analytics;
    }

    @GetMapping("/workspace")
    public WorkspaceDto workspace(Member me) {
        return workspace.snapshot(me);
    }

    @GetMapping("/analytics/finance")
    public FinanceAnalyticsDto financeAnalytics(Member me) {
        return analytics.finance(me);
    }
}
