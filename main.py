from flask import Flask, request, jsonify
import subprocess
import os

app = Flask(__name__, static_url_path='', static_folder='.')

@app.route('/')
def home():
    return app.send_static_file('index.html')

def normalize_task_dicts(payload):
    """
    Ensures tasks are represented as a list of dictionaries:
    e.g., {"name": "Write code", "status": "Done", "hours": 1.5}
    Includes try/except (KeyError, TypeError) error handling if a task is missing fields.
    """
    raw_items = []

    try:
        if isinstance(payload, dict) and "taskList" in payload and isinstance(payload["taskList"], list):
            raw_items = payload["taskList"]
        elif isinstance(payload, list):
            raw_items = payload
        elif isinstance(payload, dict) and "tasks" in payload and "statuses" in payload:
            names = payload["tasks"]
            statuses = payload["statuses"]
            hours_list = payload.get("hours", [1.0] * len(names))
            for i in range(len(names)):
                raw_items.append({
                    "name": names[i],
                    "status": statuses[i],
                    "hours": hours_list[i] if i < len(hours_list) else 1.0
                })
        else:
            raise TypeError("Unsupported payload structure")
    except (KeyError, TypeError) as err:
        print("Python Warning: Malformed payload structure:", err)
        return []

    valid_tasks = []
    for item in raw_items:
        try:
            if not isinstance(item, dict):
                raise TypeError("Task entry must be a dictionary")

            task_name = str(item["name"]).strip()
            task_status = str(item["status"]).strip()

            if not task_name or not task_status:
                continue

            try:
                task_hours = float(item.get("hours", 1.0))
                if task_hours < 0:
                    task_hours = 0.0
            except (ValueError, TypeError):
                task_hours = 1.0

            task_dict = {
                "name": task_name,
                "status": task_status,
                "hours": task_hours
            }

            valid_tasks.append(task_dict)
        except (KeyError, TypeError) as err:
            print("Python Error Handler: Skipping invalid task dictionary ({})".format(err))
            continue

    return valid_tasks

@app.route('/process', methods=['POST'])
def process_data():
    try:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "Invalid JSON payload"}), 400

        task_dicts = normalize_task_dicts(data)

        completed_tasks = list(filter(
            lambda task: task["status"].lower() == "done",
            task_dicts
        ))
        pending_tasks = list(filter(
            lambda task: task["status"].lower() != "done",
            task_dicts
        ))

    except (KeyError, TypeError) as err:
        print("Python Error during filtering:", err)
        completed_tasks = []
        pending_tasks = []

    with open("pipeline_tasks.txt", "w", encoding="utf-8") as file:
        for task in completed_tasks:
            file.write("{}|{:.2f}|Done\n".format(task["name"], task["hours"]))
        for task in pending_tasks:
            file.write("{}|{:.2f}|{}\n".format(task["name"], task["hours"], task["status"]))

    print("Python: Filtered {} completed and {} pending tasks into pipeline_tasks.txt".format(
        len(completed_tasks), len(pending_tasks)
    ))

    print("Python: Triggering C# Logic & Workflow Engine...")
    subprocess.run(["dotnet", "run"], check=False)

    report_content = ""
    if os.path.exists("daily_report.txt"):
        with open("daily_report.txt", "r", encoding="utf-8") as rep_file:
            report_content = rep_file.read()

    return jsonify({
        "message": "Pipeline finished! Report saved to daily_report.txt.",
        "completedCount": len(completed_tasks),
        "pendingCount": len(pending_tasks),
        "report": report_content
    })

@app.route('/undo/push', methods=['POST'])
def undo_push():
    try:
        data = request.get_json(silent=True) or {}
        name = str(data["name"]).strip()
        status = str(data.get("status", "to-do")).strip()
        hours = float(data.get("hours", 1.0))
        serialized = "{}|{:.2f}|{}".format(name, hours, status)

        subprocess.run(["dotnet", "run", "--", "push", serialized], check=False)
        return jsonify({"status": "pushed", "item": data})
    except (KeyError, TypeError, ValueError) as err:
        return jsonify({"error": str(err)}), 400

@app.route('/undo/pop', methods=['POST'])
def undo_pop():
    result = subprocess.run(
        ["dotnet", "run", "--", "pop"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        check=False
    )
    output_lines = [line.strip() for line in result.stdout.splitlines() if line.startswith("POPPED:")]
    if not output_lines:
        return jsonify({"status": "empty"}), 200

    popped_raw = output_lines[-1].replace("POPPED:", "", 1).strip()
    parts = popped_raw.split("|")
    restored = {
        "name": parts[0] if len(parts) > 0 else popped_raw,
        "hours": float(parts[1]) if len(parts) > 1 else 1.0,
        "status": parts[2] if len(parts) > 2 else "to-do"
    }
    return jsonify({"status": "popped", "item": restored})

@app.route('/report', methods=['GET'])
def get_report():
    if os.path.exists("daily_report.txt"):
        with open("daily_report.txt", "r", encoding="utf-8") as f:
            return f.read(), 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return "No daily report generated yet.", 404

if __name__ == '__main__':
    print("===================================================")
    print("Server running! Open http://127.0.0.1:5000 in your browser.")
    print("===================================================")
    app.run(port=5000)
