using System;
using System.IO;
using System.Globalization;
using System.Collections.Generic;
using System.Diagnostics;

namespace KanbanBoard
{
    public struct TaskStats
    {
        public string TaskName { get; set; }
        public double Hours { get; set; }

        public TaskStats(string taskName, double hours)
        {
            TaskName = taskName;
            Hours = hours;
        }

        public static TaskStats operator +(TaskStats a, TaskStats b)
        {
            return new TaskStats("Combined Workload", a.Hours + b.Hours);
        }
    }

    class Program
    {
        private const string InputFile = "pipeline_tasks.txt";
        private const string OutputFile = "csharp_output.txt";
        private const string UndoStackFile = "undo_stack.txt";

        static Stack<string> LoadUndoStack()
        {
            Stack<string> stack = new Stack<string>();
            if(File.Exists(UndoStackFile))
            {
                string[] lines = File.ReadAllLines(UndoStackFile);
                foreach(string line in lines)
                {
                    if(!string.IsNullOrWhiteSpace(line))
                    {
                        stack.Push(line);
                    }
                }
            }
            return stack;
        }

        static void SaveUndoStack(Stack<string> stack)
        {
            string[] items = stack.ToArray();
            Array.Reverse(items);
            File.WriteAllLines(UndoStackFile, items);
        }

        static void Main(string[] args)
        {
            if(args.Length >= 1)
            {
                string action = args[0].ToLowerInvariant();
                Stack<string> undoStack = LoadUndoStack();

                if(action == "push" && args.Length >= 2)
                {
                    string deletedTask = args[1];
                    undoStack.Push(deletedTask);
                    SaveUndoStack(undoStack);
                    Console.WriteLine("C#: Pushed deleted task onto LIFO Stack -> " + deletedTask);
                    return;
                }

                else if(action == "pop")
                {
                    if(undoStack.Count > 0)
                    {
                        string restoredTask = undoStack.Pop();
                        SaveUndoStack(undoStack);
                        Console.WriteLine("POPPED:" + restoredTask);
                    }

                    else
                    {
                        Console.WriteLine("EMPTY");
                    }
                    return;
                }
            }

            Console.WriteLine("C#: Waking up Logic & Workflow Engine...");

            if(!File.Exists(InputFile))
            {
                Console.WriteLine("C#: No pipeline file found. Exiting.");
                return;
            }

            string[] rawLines = File.ReadAllLines(InputFile);

            Stack<string> completedStack = new Stack<string>();
            TaskStats totalCompletedStats = new TaskStats("Completed Workload", 0.0);
            TaskStats totalDailyStats = new TaskStats("Total Daily Workload", 0.0);
            int pendingCount = 0;

            foreach(string rawLine in rawLines)
            {
                if(string.IsNullOrWhiteSpace(rawLine))
                {
                    continue;
                }

                string[] parts = rawLine.Split('|');
                string taskName = parts[0].Trim();
                double hours = 1.0;
                string status = "Done";

                if(parts.Length > 1)
                {
                    double.TryParse(parts[1], NumberStyles.Any, CultureInfo.InvariantCulture, out hours);
                }

                if(parts.Length > 2)
                {
                    status = parts[2].Trim();
                }

                TaskStats currentTask = new TaskStats(taskName, hours);
                totalDailyStats = totalDailyStats + currentTask;

                if(status.Equals("Done", StringComparison.OrdinalIgnoreCase))
                {
                    totalCompletedStats = totalCompletedStats + currentTask;
                    string formattedTask = string.Format(
                        CultureInfo.InvariantCulture,
                        "{0} ({1:0.0}h)",
                        taskName,
                        hours
                    );
                    completedStack.Push(formattedTask);
                }

                else
                {
                    pendingCount++;
                }
            }

            using(StreamWriter writer = new StreamWriter(OutputFile))
            {
                writer.WriteLine(string.Format(
                    CultureInfo.InvariantCulture,
                    "META_COMPLETED_HOURS:{0:0.00}",
                    totalCompletedStats.Hours
                ));
                writer.WriteLine(string.Format(
                    CultureInfo.InvariantCulture,
                    "META_TOTAL_HOURS:{0:0.00}",
                    totalDailyStats.Hours
                ));
                writer.WriteLine("META_PENDING_COUNT:" + pendingCount);

                while(completedStack.Count > 0)
                {
                    string task = completedStack.Pop();
                    writer.WriteLine(task);
                }
            }

            Console.WriteLine(string.Format(
                CultureInfo.InvariantCulture,
                "C#: Stack & TaskStats processed ({0:0.0}h completed / {1:0.0}h total). Triggering Java...",
                totalCompletedStats.Hours,
                totalDailyStats.Hours
            ));

            ProcessStartInfo javaProcess = new ProcessStartInfo
            {
                FileName = "java",
                Arguments = "report.java",
                UseShellExecute = false
            };
            Process.Start(javaProcess)?.WaitForExit();
        }
    }
}
