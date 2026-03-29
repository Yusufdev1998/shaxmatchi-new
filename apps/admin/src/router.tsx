import * as React from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { DebutLevelsPage } from "./pages/DebutLevelsPage";
import { CoursesPage } from "./pages/CoursesPage";
import { ModulesPage } from "./pages/ModulesPage";
import { TasksPage } from "./pages/TasksPage";
import { PuzzlesCrudPage } from "./pages/PuzzlesCrudPage";
import { PuzzlePracticePage } from "./pages/PuzzlesPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <NotFoundPage />,
  },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "debuts", element: <DebutLevelsPage /> },
      { path: "debuts/levels/:levelId/courses", element: <CoursesPage /> },
      { path: "debuts/levels/:levelId/courses/:courseId/modules", element: <ModulesPage /> },
      { path: "debuts/levels/:levelId/courses/:courseId/modules/:moduleId/tasks", element: <TasksPage /> },
      { path: "debuts/levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles", element: <PuzzlesCrudPage /> },
      { path: "debuts/levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles/:puzzleId/practice", element: <PuzzlePracticePage /> },
      { path: "users", element: <UsersPage /> },
      { path: "settings", element: <SettingsPage /> }
    ]
  }
]);

