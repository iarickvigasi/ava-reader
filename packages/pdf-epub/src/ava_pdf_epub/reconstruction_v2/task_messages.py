"""Pure request formatting; dispatch, models, budgets and credentials belong to the host."""

import json

from .recognition_contract import RecognitionTask
from .recognition_prompt import SYSTEM_PROMPT


def task_messages(task: RecognitionTask) -> list[dict[str, object]]:
    task = RecognitionTask.model_validate(task.model_dump())
    context = task.model_dump(mode="json", exclude={"image"})
    context["render_sha256"] = task.image.sha256
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": json.dumps(context, ensure_ascii=False, sort_keys=True)},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{task.image.media_type};base64,{task.image.base64}",
                    },
                },
            ],
        },
    ]
