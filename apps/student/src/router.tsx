import * as React from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { HomePage } from "./pages/HomePage";
import { DebutPage } from "./pages/DebutPage";
import { DebutCoursesPage } from "./pages/DebutCoursesPage";
import { DebutModulesPage } from "./pages/DebutModulesPage";
import { DebutTasksPage } from "./pages/DebutTasksPage";
import { DebutPuzzlesPage } from "./pages/DebutPuzzlesPage";
import { CoursePage } from "./pages/CoursePage";
import { TaskPage } from "./pages/TaskPage";
import { PuzzlePage } from "./pages/PuzzlePage";
import { LessonsPage } from "./pages/LessonsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LoginPage } from "./pages/LoginPage";
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
      { index: true, element: <HomePage /> },
      { path: "debut", element: <DebutPage /> },
      { path: "debut/levels/:levelId/courses", element: <DebutCoursesPage /> },
      { path: "debut/levels/:levelId/courses/:courseId/modules", element: <DebutModulesPage /> },
      { path: "debut/levels/:levelId/courses/:courseId/modules/:moduleId/tasks", element: <DebutTasksPage /> },
      { path: "debut/levels/:levelId/courses/:courseId/modules/:moduleId/tasks/:taskId/puzzles", element: <DebutPuzzlesPage /> },
      { path: "course/:id", element: <CoursePage /> },
      { path: "task/:id", element: <TaskPage /> },
      { path: "puzzle/:id", element: <PuzzlePage /> },
      { path: "lessons", element: <LessonsPage /> },
      { path: "profile", element: <ProfilePage /> }
    ]
  }
]);

