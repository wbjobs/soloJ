using System.Collections;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using Grpc.Core;
using StateService;

public class MMORPGTestClient : MonoBehaviour
{
    public int botCount = 1000;
    public float mapRadius = 200f;
    public float skillInterval = 2.0f;
    public bool enablePressureTest = true;

    [Header("Server Config")]
    public string stateServerAddr = "localhost:50051";
    public string collisionServerAddr = "localhost:50052";
    public string damageServerAddr = "localhost:50053";

    [Header("Stats")]
    public float avgLatencyMs;
    public int totalDamageEvents;
    public int skillsPerSecond;
    public float frameRate;

    private Channel stateChannel;
    private StateService.StateServiceClient stateClient;
    private AsyncDuplexStreamingCall<StateUpdate, StateSnapshot> stateStream;

    private List<BotAgent> bots = new List<BotAgent>();
    private CancellationTokenSource cts;
    private long skillCounter;
    private long lastSkillCount;
    private float statsTimer;
    private Queue<float> latencySamples = new Queue<float>();

    void Start()
    {
        cts = new CancellationTokenSource();
        ConnectToServers();
        SpawnBots();
        StartCoroutine(PressureTestLoop());
    }

    async void ConnectToServers()
    {
        stateChannel = new Channel(stateServerAddr, ChannelCredentials.Insecure);
        stateClient = new StateService.StateServiceClient(stateChannel);

        Debug.Log($"Connected to state server: {stateServerAddr}");
    }

    void SpawnBots()
    {
        for (int i = 0; i < botCount; i++)
        {
            Vector3 pos = Random.insideUnitSphere * mapRadius;
            pos.y = 0;

            GameObject botObj = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            botObj.name = $"Bot_{i:D4}";
            botObj.transform.position = pos;

            Renderer renderer = botObj.GetComponent<Renderer>();
            renderer.material.color = Random.ColorHSV(0, 1, 0.7f, 1, 0.8f, 1);

            BotAgent bot = botObj.AddComponent<BotAgent>();
            bot.Initialize(this, i, pos, i % 2 == 0 ? 1 : 2);
            bots.Add(bot);
        }

        Debug.Log($"Spawned {botCount} bots");
    }

    IEnumerator PressureTestLoop()
    {
        while (!cts.IsCancellationRequested && enablePressureTest)
        {
            Parallel.ForEach(bots, bot =>
            {
                if (bot.CanCastSkill)
                {
                    bot.CastRandomSkill();
                    Interlocked.Increment(ref skillCounter);
                }
            });

            yield return new WaitForSeconds(skillInterval / 10f);
        }
    }

    void Update()
    {
        statsTimer += Time.deltaTime;
        if (statsTimer >= 1f)
        {
            skillsPerSecond = (int)((skillCounter - lastSkillCount) / statsTimer);
            lastSkillCount = skillCounter;
            statsTimer = 0f;
            frameRate = 1f / Time.smoothDeltaTime;
        }

        if (latencySamples.Count > 100)
        {
            latencySamples.Dequeue();
        }
        if (latencySamples.Count > 0)
        {
            float sum = 0;
            foreach (var l in latencySamples) sum += l;
            avgLatencyMs = sum / latencySamples.Count;
        }
    }

    public void RecordLatency(float latencyMs)
    {
        lock (latencySamples)
        {
            latencySamples.Enqueue(latencyMs);
        }
    }

    public void IncrementDamageEvents()
    {
        Interlocked.Increment(ref totalDamageEvents);
    }

    async void OnDestroy()
    {
        cts?.Cancel();
        cts?.Dispose();

        if (stateStream != null)
        {
            await stateStream.RequestStream.CompleteAsync();
            stateStream.Dispose();
        }

        if (stateChannel != null)
        {
            await stateChannel.ShutdownAsync();
        }
    }

    void OnGUI()
    {
        GUI.Box(new Rect(10, 10, 280, 140), "MMORPG Stress Test");
        GUILayout.BeginArea(new Rect(20, 35, 260, 110));
        GUILayout.Label($"Bots: {bots.Count}/{botCount}");
        GUILayout.Label($"FPS: {frameRate:F1}");
        GUILayout.Label($"Skills/sec: {skillsPerSecond}");
        GUILayout.Label($"Total Skills: {skillCounter}");
        GUILayout.Label($"Avg Latency: {avgLatencyMs:F2}ms");
        GUILayout.Label($"Damage Events: {totalDamageEvents}");
        GUILayout.EndArea();
    }
}
