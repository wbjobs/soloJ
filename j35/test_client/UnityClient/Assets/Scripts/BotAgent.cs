using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using Random = UnityEngine.Random;

public class BotAgent : MonoBehaviour
{
    public int BotId { get; private set; }
    public int TeamId { get; private set; }
    public uint EntityId { get; private set; }
    public float Hp { get; private set; }
    public float MaxHp { get; private set; }
    public bool CanCastSkill => lastSkillTime + skillCooldown <= Time.time;

    [Header("Movement")]
    public float moveSpeed = 5f;
    public float wanderRadius = 50f;

    [Header("Combat")]
    public float skillCooldown = 2.0f;
    public int[] skillIds = { 1, 2, 3, 4 };

    private MMORPGTestClient client;
    private Vector3 targetPosition;
    private float lastSkillTime;
    private Vector3 velocity;
    private List<BotAgent> nearbyEnemies = new List<BotAgent>();

    public void Initialize(MMORPGTestClient client, int botId, Vector3 spawnPos, int teamId)
    {
        this.client = client;
        BotId = botId;
        TeamId = teamId;
        transform.position = spawnPos;
        targetPosition = spawnPos;
        Hp = MaxHp = 1000f;
    }

    void Update()
    {
        UpdateMovement();
        UpdateNearbyEnemies();
    }

    void UpdateMovement()
    {
        if (Random.value < 0.01f)
        {
            Vector2 rand = Random.insideUnitCircle * wanderRadius;
            targetPosition = new Vector3(rand.x, 0, rand.y);
        }

        Vector3 dir = (targetPosition - transform.position).normalized;
        velocity = dir * moveSpeed;
        transform.position += velocity * Time.deltaTime;

        if (velocity.sqrMagnitude > 0.01f)
        {
            transform.forward = new Vector3(velocity.x, 0, velocity.z);
        }
    }

    void UpdateNearbyEnemies()
    {
        nearbyEnemies.Clear();
        Collider[] hits = Physics.OverlapSphere(transform.position, 30f);
        foreach (var hit in hits)
        {
            BotAgent bot = hit.GetComponent<BotAgent>();
            if (bot != null && bot != this && bot.TeamId != TeamId)
            {
                nearbyEnemies.Add(bot);
            }
        }
    }

    public async void CastRandomSkill()
    {
        if (nearbyEnemies.Count == 0) return;

        lastSkillTime = Time.time;

        int skillIndex = Random.Range(0, skillIds.Length);
        int skillId = skillIds[skillIndex];

        BotAgent target = nearbyEnemies[Random.Range(0, nearbyEnemies.Count)];

        var sw = Stopwatch.StartNew();
        try
        {
            await SimulateSkillCast(skillId, target);
            sw.Stop();
            client.RecordLatency(sw.ElapsedMilliseconds);
            client.IncrementDamageEvents();
        }
        catch (Exception e)
        {
            UnityEngine.Debug.LogWarning($"Skill cast failed: {e.Message}");
        }
    }

    async Task SimulateSkillCast(int skillId, BotAgent target)
    {
        await Task.Delay(Random.Range(5, 20));

        float damage = Random.Range(50, 150);
        bool isCrit = Random.value < 0.2f;
        if (isCrit) damage *= 2;

        target.TakeDamage(damage);

        CreateSkillEffect(skillId, target.transform.position);
    }

    public void TakeDamage(float damage)
    {
        Hp = Mathf.Max(0, Hp - damage);

        if (Hp <= 0)
        {
            StartCoroutine(RespawnCoroutine());
        }
    }

    IEnumerator RespawnCoroutine()
    {
        gameObject.SetActive(false);
        yield return new WaitForSeconds(5f);
        Hp = MaxHp;

        Vector2 rand = Random.insideUnitCircle * 150f;
        transform.position = new Vector3(rand.x, 0, rand.y);
        gameObject.SetActive(true);
    }

    void CreateSkillEffect(int skillId, Vector3 targetPos)
    {
        GameObject effect = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        effect.transform.position = targetPos;
        effect.transform.localScale = Vector3.one * 3f;
        Destroy(effect.GetComponent<Collider>());

        Renderer r = effect.GetComponent<Renderer>();
        r.material = new Material(Shader.Find("Standard"));
        r.material.color = TeamId == 1 ? Color.red : Color.blue;
        r.material.SetFloat("_Metallic", 0.5f);
        r.material.SetFloat("_Glossiness", 0.8f);
        r.material.SetOverrideTag("RenderType", "Transparent");
        r.material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
        r.material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
        r.material.SetInt("_ZWrite", 0);
        r.material.DisableKeyword("_ALPHATEST_ON");
        r.material.EnableKeyword("_ALPHABLEND_ON");
        r.material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
        r.material.renderQueue = 3000;

        Color c = r.material.color;
        c.a = 0.6f;
        r.material.color = c;

        Destroy(effect, 0.5f);
    }

    void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(transform.position, 30f);
    }
}
