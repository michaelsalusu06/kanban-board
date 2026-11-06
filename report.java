import java.io.File;
import java.util.Scanner;
import java.util.Formatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;

public class report 
{
    public static void main(String[] args) 
    {
        System.out.println("Java: Waking up Daily Report Generator...");

        ArrayList<String> completedTasks = new ArrayList<String>();
        double completedHours = 0.0;
        double totalWorkloadHours = 0.0;
        int pendingCount = 0;

        try 
        {
            File inputFile = new File("csharp_output.txt");
            if(inputFile.exists()) 
            {
                Scanner sc = new Scanner(inputFile, "UTF-8");
                while(sc.hasNextLine()) 
                {
                    String line = sc.nextLine().trim();
                    if(line.isEmpty()) 
                    {
                        continue;
                    }

                    if(line.startsWith("META_COMPLETED_HOURS:")) 
                    {
                        completedHours = Double.parseDouble(line.substring("META_COMPLETED_HOURS:".length()).trim());
                    } 
                    
                    else if(line.startsWith("META_TOTAL_HOURS:")) 
                    {
                        totalWorkloadHours = Double.parseDouble(line.substring("META_TOTAL_HOURS:".length()).trim());
                    } 
                    
                    else if(line.startsWith("META_PENDING_COUNT:")) 
                    {
                        pendingCount = Integer.parseInt(line.substring("META_PENDING_COUNT:".length()).trim());
                    } 
                    
                    else 
                    {
                        completedTasks.add(line);
                    }
                }
                sc.close();
            }

            Collections.sort(completedTasks);
            File outputFile = new File("daily_report.txt");
            Formatter f = new Formatter(outputFile);

            f.format("====================================================\r\n");
            f.format("          DAILY PRODUCTIVITY & WORKLOAD LOG         \r\n");
            f.format("====================================================\r\n\r\n");
            f.format("COMPLETED TASKS (Alphabetical Roster):\r\n");
            f.format("----------------------------------------------------\r\n");

            if(completedTasks.isEmpty()) 
            {
                f.format("  (No completed tasks recorded yet)\r\n");
            } 
            
            else 
            {
                int index = 1;
                for(String task : completedTasks) 
                {
                    f.format("  %d. %s\r\n", index++, task);
                }
            }

            f.format("\r\n----------------------------------------------------\r\n");
            f.format("WORKLOAD SUMMARY\r\n");
            f.format("----------------------------------------------------\r\n");
            f.format("  Completed Tasks        : %d\r\n", completedTasks.size());
            f.format("  Pending Tasks          : %d\r\n", pendingCount);
            f.format("  Completed Work Hours   : %.1f hrs\r\n", completedHours);
            f.format("  Total Daily Workload   : %.1f hrs\r\n", totalWorkloadHours);
            f.format("====================================================\r\n");
            f.close();
            System.out.println("Java: Successfully generated daily_report.txt!");

        } 
        
        catch(Exception e) 
        {
            System.out.println("Java Error: " + e.getMessage());
        }
    }
}
