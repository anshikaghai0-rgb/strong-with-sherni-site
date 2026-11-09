// All challenge content lives here. To add a new challenge later, copy the
// 'sugar-break' block, change the id/name/tasks, and it will work in the app.
// VIDEOS: add  video: 'https://youtu.be/XXXX'  (or an .mp4 link) to any day below
// and it will show inside that day's task card automatically.
window.SWS_CHALLENGES = {
  'sugar-break': {
    id: 'sugar-break',
    name: 'Sugar Break',
    tagline: '21 days. Zero added sugar.',
    days: 21,
    windowDays: 42,
    points: { sugarFree: 40, task: 30, quizRight: 20, quizWrong: 10, craving: 10, unlock: 70 },
    rules: {
      no: [
        'White or brown sugar in tea, coffee or food',
        'Jaggery, honey, syrups and "natural" sweeteners',
        'Mithai, desserts, chocolates, ice cream',
        'Biscuits, cakes, pastries, sweet breads',
        'Cold drinks, packaged juices, energy drinks',
        'Flavoured yogurt, sweetened cereal, ketchup and sweet sauces'
      ],
      yes: [
        'Whole fruits (1-2 servings a day)',
        'Plain milk, curd, paneer, buttermilk',
        'Dal, sabzi, roti, rice, eggs, chicken, fish',
        'Nuts, seeds, roasted chana, makhana',
        'Water, plain nimbu pani, unsweetened tea or coffee'
      ]
    },
    weeks: [
      { n: 1, title: 'Break', sub: 'Days 1-7 · The hardest week. Cravings peak, then start to fade.' },
      { n: 2, title: 'Rebuild', sub: 'Days 8-14 · Your taste buds reset. Food starts tasting sweeter.' },
      { n: 3, title: 'Own it', sub: 'Days 15-21 · Make sugar-free feel normal, even at parties.' }
    ],
    tasks: [
      { day: 1,  title: 'Clear the kitchen', task: 'Remove or hide all sweets, biscuits and sugary drinks at home. Out of sight, out of mind.', tip: 'Tell your family you\'re doing this challenge, so they can support you.', quiz: {"q": "Which of these usually has the most added sugar?", "options": ["A cup of plain curd", "A 'healthy' packaged fruit juice", "A bowl of dal"], "answer": 1, "why": "Packaged juices can have 5-6 teaspoons of sugar per glass, even the 'no added preservatives' ones."} },
      { day: 2,  title: 'Protein breakfast', task: 'Start the day with protein: eggs, paneer, curd, dal chilla or sprouts.', tip: 'A protein breakfast keeps blood sugar steady and cuts cravings later in the day.', quiz: {"q": "Why does a protein breakfast help with cravings?", "options": ["It keeps blood sugar steady for longer", "It has more sugar", "It makes you sleepy"], "answer": 0, "why": "Protein digests slowly, so your blood sugar doesn't spike and crash, which is what triggers cravings."} },
      { day: 3,  title: 'Plain chai day', task: 'Have your tea or coffee with zero sugar. Add cinnamon or elaichi for flavour.', tip: 'It tastes strange for 3-4 days. After that, sweet chai will taste too sweet.', quiz: {"q": "Is jaggery (gud) allowed in this challenge?", "options": ["Yes, it's natural", "No, it is still added sugar"], "answer": 1, "why": "Jaggery, honey and brown sugar are all still sugar. Your body treats them almost the same."} },
      { day: 4,  title: 'Plan the 4 PM snack', task: 'Keep a sugar-free snack ready: fruit with nuts, roasted chana or makhana.', tip: 'Most sugar slips happen when you are hungry and unprepared.', quiz: {"q": "When do most people slip on a sugar-free day?", "options": ["Right after breakfast", "When hungry and unprepared, like 4 PM", "While sleeping"], "answer": 1, "why": "Hunger + no plan = sugar. Keeping a ready snack is your best defence."} },
      { day: 5,  title: 'Water first', task: 'Drink 3 litres of water today. When a craving hits, drink a glass first.', tip: 'Thirst often feels like a sugar craving.', quiz: {"q": "A sudden sugar craving can sometimes actually be...", "options": ["Thirst", "A vitamin overdose", "Too much protein"], "answer": 0, "why": "Thirst signals are easy to mix up with cravings. Drink a glass of water first."} },
      { day: 6,  title: 'Label detective', task: 'Read the labels of 3 packaged foods at home. Look for sugar, glucose, maltodextrin, syrup.', tip: 'Sugar hides under more than 50 different names.', quiz: {"q": "Which word on a label means sugar?", "options": ["Maltodextrin", "Fibre", "Sodium"], "answer": 0, "why": "Maltodextrin, glucose syrup, dextrose and sucrose are all forms of sugar."} },
      { day: 7,  title: 'Week 1 check-in', task: 'Write down how your cravings, sleep and energy feel compared to Day 1.', tip: 'You just finished the hardest week. Be proud of that.', quiz: {"q": "When do sugar cravings usually start to fade?", "options": ["After 1 day", "After about 1-2 weeks", "Never"], "answer": 1, "why": "Most people notice cravings drop a lot after the first 7-14 days. You're getting there."} },
      { day: 8,  title: 'Sleep 7+ hours', task: 'Get to bed early tonight. Aim for 7-8 hours of sleep.', tip: 'Poor sleep increases hunger hormones and sugar cravings the next day.', quiz: {"q": "How does poor sleep affect sugar cravings?", "options": ["It increases them", "It has no effect", "It removes them"], "answer": 0, "why": "Less sleep raises hunger hormones, so you reach for quick energy like sugar."} },
      { day: 9,  title: 'Fibre at every meal', task: 'Add salad, sabzi or dal to every meal today.', tip: 'Fibre slows digestion and keeps you full for longer.', quiz: {"q": "Which helps you feel full for longer?", "options": ["Fibre from sabzi and dal", "A cold drink", "A biscuit"], "answer": 0, "why": "Fibre slows digestion and keeps you satisfied, so cravings stay away."} },
      { day: 10, title: 'Craving rescue', task: 'When a craving comes, wait 10 minutes, drink water and take a short walk. Then decide.', tip: 'Most cravings pass in 10-15 minutes if you don\'t feed them.', quiz: {"q": "How long does a typical craving last if you don't feed it?", "options": ["10-15 minutes", "3 hours", "A full day"], "answer": 0, "why": "Cravings come in waves. Distract yourself for 10-15 minutes and it usually passes."} },
      { day: 11, title: 'Move after meals', task: 'Take a 10-minute walk after lunch or dinner.', tip: 'A short walk after eating helps your body manage blood sugar better.', quiz: {"q": "What does a 10-minute walk after a meal help with?", "options": ["Managing blood sugar", "Adding sugar to blood", "Nothing at all"], "answer": 0, "why": "Moving after meals helps your muscles use up sugar from your food."} },
      { day: 12, title: 'Sugar-free dessert', task: 'Make a sugar-free sweet: fruit with cinnamon, chia pudding with fruit, or curd with berries.', tip: 'Fruit tastes much sweeter now that your taste buds are resetting.', quiz: {"q": "Which is a sugar-free sweet option?", "options": ["Fruit with cinnamon", "Gulab jamun", "Flavoured yogurt"], "answer": 0, "why": "Fruit's natural sweetness plus cinnamon satisfies a sweet tooth with no added sugar."} },
      { day: 13, title: 'Eat out smart', task: 'If you eat out or order in, skip the sweet drink and dessert. Choose protein + veggies.', tip: 'Say "no sugar please" when you order chai, lassi or nimbu pani.', quiz: {"q": "Which drink is safest when eating out?", "options": ["Sweet lassi", "Plain buttermilk (chaas)", "Fresh lime soda, sweet"], "answer": 1, "why": "Plain chaas has no added sugar. Always say 'no sugar' when ordering."} },
      { day: 14, title: 'Week 2 check-in', task: 'Notice your energy at 4 PM, your skin and your bloating. What changed?', tip: 'Two weeks done. Your body is already thanking you.', quiz: {"q": "Which can improve after 2 weeks without added sugar?", "options": ["Energy and bloating", "Nothing changes", "Only your weight"], "answer": 0, "why": "Many people notice steadier energy, less bloating and clearer skin."} },
      { day: 15, title: 'Your 3 favourite swaps', task: 'Write down the 3 swaps that worked best for you so far.', tip: 'These swaps are your toolkit for life after the challenge.', quiz: {"q": "Which ketchup fact is true?", "options": ["It has no sugar", "It often has a lot of added sugar", "It is pure tomato"], "answer": 1, "why": "One tablespoon of ketchup can have about a teaspoon of sugar."} },
      { day: 16, title: 'Stress without sugar', task: 'When stressed, try 5 deep breaths, a walk or calling a friend instead of reaching for sweets.', tip: 'We often eat sugar for comfort, not hunger.', quiz: {"q": "Why do we reach for sweets when stressed?", "options": ["Sugar gives a quick comfort boost", "Sugar cures stress", "Our body needs sugar to relax"], "answer": 0, "why": "Sugar gives a short mood lift, then a crash. A walk or deep breaths work better."} },
      { day: 17, title: 'Party plan', task: 'Plan how you\'ll handle the next party, festival or office treat. Decide in advance.', tip: 'Eat a protein snack before you go, and hold a glass of water in your hand.', quiz: {"q": "What helps most at a party?", "options": ["Going hungry", "Eating a protein snack before you go", "Skipping water"], "answer": 1, "why": "Arriving full makes it much easier to say no to desserts."} },
      { day: 18, title: 'Sugar-free cooking', task: 'Cook one meal at home with no hidden sugar. Check sauces and masalas.', tip: 'Many ready-made sauces and gravies have added sugar.', quiz: {"q": "Which of these often hides sugar?", "options": ["Ready-made gravies and sauces", "Plain boiled eggs", "Fresh vegetables"], "answer": 0, "why": "Many packaged sauces and masala mixes have added sugar. Check labels."} },
      { day: 19, title: 'Learn to say no', task: 'Practise one polite line: "No thanks, I\'m off sugar right now."', tip: 'Saying it confidently makes people stop pushing.', quiz: {"q": "What's the easiest way to refuse a sweet politely?", "options": ["Make a long excuse", "Say 'No thanks, I'm off sugar right now'", "Take it and hide it"], "answer": 1, "why": "Short, confident and kind. People usually stop pushing."} },
      { day: 20, title: 'Share your win', task: 'Share your biggest win from this challenge in the WhatsApp group.', tip: 'Your story might inspire someone else in your batch.', quiz: {"q": "Does sharing your progress help?", "options": ["Yes, it builds accountability", "No, keep it secret", "It makes things harder"], "answer": 0, "why": "Telling others makes you more likely to stick with it."} },
      { day: 21, title: 'Your sugar rule', task: 'Write your own sugar rule for the next month, e.g. "Sweets only on Sundays".', tip: 'You did 21 days with zero added sugar. That\'s huge. Celebrate (without cake)!', quiz: {"q": "After the challenge, what's best?", "options": ["Go back to old habits", "Set your own simple sugar rule", "Never eat fruit"], "answer": 1, "why": "A clear personal rule, like 'sweets only on Sundays', keeps your progress going."} }
    ],
    sos: [
      'Drink a big glass of water and wait 10 minutes.',
      'Eat something with protein: a boiled egg, a handful of nuts, paneer or curd.',
      'Have a piece of fruit with 4-5 almonds.',
      'Go for a 5-minute walk or do 10 squats.',
      'Brush your teeth. Sweet cravings drop right after.',
      'Chew on saunf, elaichi or a clove.',
      'Message the WhatsApp group: "Craving alert!" Your batch will cheer you on.'
    ]
  }
};
