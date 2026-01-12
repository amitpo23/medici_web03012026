// src/app/dashboard/dashboard.component.ts
import { Component } from "@angular/core"
import { CommonModule } from "@angular/common"
import { StatsCardsComponent } from "./stats-cards/stats-cards.component"
import { PatientTableComponent } from "./patient-table/patient-table.component"

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, StatsCardsComponent, PatientTableComponent],
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.css"],
})
export class DashboardComponent {
  currentTheme: "light" | "dark" = "light"

  toggleTheme(): void {
    this.currentTheme = this.currentTheme === "light" ? "dark" : "light"
    document.documentElement.setAttribute("data-theme", this.currentTheme)
  }
}
