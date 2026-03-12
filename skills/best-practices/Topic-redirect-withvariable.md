TBD kind: AdaptiveDialog
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    triggerQueries:
      - Dynamic redirects
actions:
    - kind: SetVariable
      id: setVariable_7bgfoP
      variable: Topic.MyVariable
      value: =RandBetween(0,4)
- kind: BeginDialog
      id: A4lDAn
      dialog: |-
        =Switch(
                    Topic.MyVariable,
                    1, "cat_MyBot.topic.Lesson1",
                    2, "cat_MyBot.topic.Lesson2",
                    3, "cat_MyBot.topic.Lesson3",
                   "cat_MyBot.topic.Fallback"
                )
